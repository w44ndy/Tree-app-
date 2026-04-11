from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
import io
import base64
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Helpers ──────────────────────────────────────────────────
def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role, "exp": datetime.now(timezone.utc) + timedelta(hours=8), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def serialize_doc(doc):
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return {"id": user["_id"], "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "viewer")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=28800, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

# ── Auth Models ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "driver"

# ── Auth Endpoints ───────────────────────────────────────────
@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    email = req.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    access = create_access_token(uid, email, user.get("role", "viewer"))
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": user.get("name", ""), "role": user.get("role", "viewer")}

@api_router.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.strip().lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name,
        "role": req.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(doc)
    uid = str(result.inserted_id)
    access = create_access_token(uid, email, req.role)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": req.name, "role": req.role}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        uid = str(user["_id"])
        access = create_access_token(uid, user["email"], user.get("role", "viewer"))
        response.set_cookie(key="access_token", value=access, httponly=True, secure=False, samesite="lax", max_age=28800, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ── Pallet Models & Endpoints ────────────────────────────────
class PalletCreate(BaseModel):
    pallet_number: str
    tree_color: str  # green, blue, silver
    tree_species: str = "Nordmann Fir"
    tree_size: str = "6ft"
    quantity: int = 50
    location: str = "field"
    yard_position: Optional[str] = None
    notes: Optional[str] = None

class PalletUpdate(BaseModel):
    tree_color: Optional[str] = None
    tree_species: Optional[str] = None
    tree_size: Optional[str] = None
    quantity: Optional[int] = None
    location: Optional[str] = None
    status: Optional[str] = None
    yard_position: Optional[str] = None
    notes: Optional[str] = None

@api_router.get("/pallets")
async def list_pallets(status: Optional[str] = None, color: Optional[str] = None, location: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if color:
        query["tree_color"] = color
    if location:
        query["location"] = location
    pallets = await db.pallets.find(query).sort("created_at", -1).to_list(1000)
    return [serialize_doc(p) for p in pallets]

@api_router.post("/pallets")
async def create_pallet(pallet: PalletCreate, user=Depends(get_current_user)):
    doc = pallet.model_dump()
    doc["status"] = "in_yard" if doc["location"] != "field" else "in_field"
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = user["id"]
    result = await db.pallets.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@api_router.get("/pallets/{pallet_id}")
async def get_pallet(pallet_id: str, user=Depends(get_current_user)):
    pallet = await db.pallets.find_one({"_id": ObjectId(pallet_id)})
    if not pallet:
        raise HTTPException(status_code=404, detail="Pallet not found")
    return serialize_doc(pallet)

@api_router.put("/pallets/{pallet_id}")
async def update_pallet(pallet_id: str, update: PalletUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in update.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.pallets.update_one({"_id": ObjectId(pallet_id)}, {"$set": updates})
    pallet = await db.pallets.find_one({"_id": ObjectId(pallet_id)})
    return serialize_doc(pallet)

@api_router.delete("/pallets/{pallet_id}")
async def delete_pallet(pallet_id: str, user=Depends(get_current_user)):
    result = await db.pallets.delete_one({"_id": ObjectId(pallet_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pallet not found")
    return {"message": "Deleted"}

# ── QR Code Endpoint ─────────────────────────────────────────
@api_router.get("/pallets/{pallet_id}/qr")
async def get_pallet_qr(pallet_id: str, user=Depends(get_current_user)):
    import qrcode
    pallet = await db.pallets.find_one({"_id": ObjectId(pallet_id)})
    if not pallet:
        raise HTTPException(status_code=404, detail="Pallet not found")
    qr_data = f"PALLET:{pallet_id}|NUM:{pallet.get('pallet_number','')}|COLOR:{pallet.get('tree_color','')}|QTY:{pallet.get('quantity','')}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return {"qr_base64": base64.b64encode(buf.read()).decode(), "qr_data": qr_data}

# ── Yard Locations ───────────────────────────────────────────
class YardLocationCreate(BaseModel):
    name: str
    section: str = "A"
    capacity: int = 20
    description: Optional[str] = None

@api_router.get("/yard-locations")
async def list_yard_locations(user=Depends(get_current_user)):
    locations = await db.yard_locations.find().to_list(100)
    result = []
    for loc in locations:
        loc_data = serialize_doc(loc)
        count = await db.pallets.count_documents({"yard_position": loc_data["name"], "status": {"$in": ["in_yard"]}})
        loc_data["current_stock"] = count
        result.append(loc_data)
    return result

@api_router.post("/yard-locations")
async def create_yard_location(loc: YardLocationCreate, user=Depends(get_current_user)):
    doc = loc.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.yard_locations.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@api_router.delete("/yard-locations/{loc_id}")
async def delete_yard_location(loc_id: str, user=Depends(get_current_user)):
    await db.yard_locations.delete_one({"_id": ObjectId(loc_id)})
    return {"message": "Deleted"}

# ── Orders ───────────────────────────────────────────────────
class OrderItem(BaseModel):
    tree_color: str
    tree_size: str = "6ft"
    quantity: int

class OrderCreate(BaseModel):
    customer_name: str
    delivery_address: str
    contact_phone: Optional[str] = None
    items: List[OrderItem]
    delivery_date: Optional[str] = None
    notes: Optional[str] = None

class OrderUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

@api_router.get("/orders")
async def list_orders(status: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    orders = await db.orders.find(query).sort("created_at", -1).to_list(500)
    return [serialize_doc(o) for o in orders]

@api_router.post("/orders")
async def create_order(order: OrderCreate, user=Depends(get_current_user)):
    doc = order.model_dump()
    doc["status"] = "pending"
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = user["id"]
    result = await db.orders.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@api_router.put("/orders/{order_id}")
async def update_order(order_id: str, update: OrderUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in update.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": updates})
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_doc(order)

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user=Depends(get_current_user)):
    await db.orders.delete_one({"_id": ObjectId(order_id)})
    return {"message": "Deleted"}

# ── Stock Check ──────────────────────────────────────────────
@api_router.get("/stock/check")
async def check_stock(user=Depends(get_current_user)):
    """Returns available stock grouped by color and size"""
    pipeline = [
        {"$match": {"status": {"$in": ["in_yard", "in_field"]}}},
        {"$group": {"_id": {"color": "$tree_color", "size": "$tree_size"}, "total_quantity": {"$sum": "$quantity"}, "pallet_count": {"$sum": 1}}}
    ]
    results = await db.pallets.aggregate(pipeline).to_list(100)
    stock = {}
    for r in results:
        key = f"{r['_id']['color']}_{r['_id']['size']}"
        stock[key] = {"color": r["_id"]["color"], "size": r["_id"]["size"], "total_quantity": r["total_quantity"], "pallet_count": r["pallet_count"]}
    return stock

@api_router.post("/orders/{order_id}/check-fulfillment")
async def check_order_fulfillment(order_id: str, user=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    results = []
    can_fulfill = True
    for item in order.get("items", []):
        available = await db.pallets.aggregate([
            {"$match": {"tree_color": item["tree_color"], "tree_size": item.get("tree_size", "6ft"), "status": {"$in": ["in_yard"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
        ]).to_list(1)
        avail_qty = available[0]["total"] if available else 0
        ok = avail_qty >= item["quantity"]
        if not ok:
            can_fulfill = False
        results.append({"tree_color": item["tree_color"], "tree_size": item.get("tree_size", "6ft"), "requested": item["quantity"], "available": avail_qty, "can_fulfill": ok})
    return {"can_fulfill": can_fulfill, "items": results}

# ── Lorries ──────────────────────────────────────────────────
class LorryCreate(BaseModel):
    registration: str
    name: str
    capacity: int = 20

@api_router.get("/lorries")
async def list_lorries(user=Depends(get_current_user)):
    lorries = await db.lorries.find().to_list(50)
    return [serialize_doc(l) for l in lorries]

@api_router.post("/lorries")
async def create_lorry(lorry: LorryCreate, user=Depends(get_current_user)):
    doc = lorry.model_dump()
    doc["status"] = "available"
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.lorries.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@api_router.delete("/lorries/{lorry_id}")
async def delete_lorry(lorry_id: str, user=Depends(get_current_user)):
    await db.lorries.delete_one({"_id": ObjectId(lorry_id)})
    return {"message": "Deleted"}

# ── Loads ────────────────────────────────────────────────────
class LoadDestination(BaseModel):
    address: str
    order_id: Optional[str] = None
    notes: Optional[str] = None

class LoadPallet(BaseModel):
    pallet_id: str
    position: str  # e.g. "A1", "B3" etc.

class LoadCreate(BaseModel):
    lorry_id: str
    destinations: List[LoadDestination]
    departure_date: Optional[str] = None
    driver_name: Optional[str] = None
    notes: Optional[str] = None

class LoadUpdate(BaseModel):
    status: Optional[str] = None
    pallets: Optional[List[LoadPallet]] = None
    destinations: Optional[List[LoadDestination]] = None
    notes: Optional[str] = None

@api_router.get("/loads")
async def list_loads(status: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    loads = await db.loads.find(query).sort("created_at", -1).to_list(200)
    return [serialize_doc(l) for l in loads]

@api_router.post("/loads")
async def create_load(load: LoadCreate, user=Depends(get_current_user)):
    doc = load.model_dump()
    doc["pallets"] = []
    doc["status"] = "loading"
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = user["id"]
    result = await db.loads.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    # Update lorry status
    await db.lorries.update_one({"_id": ObjectId(load.lorry_id)}, {"$set": {"status": "loading"}})
    return doc

@api_router.get("/loads/{load_id}")
async def get_load(load_id: str, user=Depends(get_current_user)):
    load = await db.loads.find_one({"_id": ObjectId(load_id)})
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    return serialize_doc(load)

@api_router.put("/loads/{load_id}")
async def update_load(load_id: str, update: LoadUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in update.model_dump().items() if v is not None}
    if "pallets" in updates:
        updates["pallets"] = [p if isinstance(p, dict) else p.model_dump() for p in updates["pallets"]]
    if "destinations" in updates:
        updates["destinations"] = [d if isinstance(d, dict) else d.model_dump() for d in updates["destinations"]]
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.loads.update_one({"_id": ObjectId(load_id)}, {"$set": updates})
    # If status changed to loaded, update pallet statuses
    if updates.get("status") == "in_transit":
        load = await db.loads.find_one({"_id": ObjectId(load_id)})
        if load:
            for p in load.get("pallets", []):
                await db.pallets.update_one({"_id": ObjectId(p["pallet_id"])}, {"$set": {"status": "loaded"}})
            if load.get("lorry_id"):
                await db.lorries.update_one({"_id": ObjectId(load["lorry_id"])}, {"$set": {"status": "in_transit"}})
    if updates.get("status") == "delivered":
        load = await db.loads.find_one({"_id": ObjectId(load_id)})
        if load:
            for p in load.get("pallets", []):
                await db.pallets.update_one({"_id": ObjectId(p["pallet_id"])}, {"$set": {"status": "delivered"}})
            if load.get("lorry_id"):
                await db.lorries.update_one({"_id": ObjectId(load["lorry_id"])}, {"$set": {"status": "available"}})
    load = await db.loads.find_one({"_id": ObjectId(load_id)})
    return serialize_doc(load)

@api_router.post("/loads/{load_id}/add-pallet")
async def add_pallet_to_load(load_id: str, pallet: LoadPallet, user=Depends(get_current_user)):
    load = await db.loads.find_one({"_id": ObjectId(load_id)})
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    pallets = load.get("pallets", [])
    pallets.append(pallet.model_dump())
    await db.loads.update_one({"_id": ObjectId(load_id)}, {"$set": {"pallets": pallets}})
    await db.pallets.update_one({"_id": ObjectId(pallet.pallet_id)}, {"$set": {"status": "loading", "location": "lorry"}})
    load = await db.loads.find_one({"_id": ObjectId(load_id)})
    return serialize_doc(load)

@api_router.post("/loads/{load_id}/remove-pallet")
async def remove_pallet_from_load(load_id: str, pallet_id: str, user=Depends(get_current_user)):
    load = await db.loads.find_one({"_id": ObjectId(load_id)})
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    pallets = [p for p in load.get("pallets", []) if p["pallet_id"] != pallet_id]
    await db.loads.update_one({"_id": ObjectId(load_id)}, {"$set": {"pallets": pallets}})
    await db.pallets.update_one({"_id": ObjectId(pallet_id)}, {"$set": {"status": "in_yard", "location": "yard"}})
    load = await db.loads.find_one({"_id": ObjectId(load_id)})
    return serialize_doc(load)

# ── Dashboard Stats ──────────────────────────────────────────
@api_router.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    total_pallets = await db.pallets.count_documents({})
    in_yard = await db.pallets.count_documents({"status": "in_yard"})
    in_field = await db.pallets.count_documents({"status": "in_field"})
    loaded = await db.pallets.count_documents({"status": {"$in": ["loaded", "loading"]}})
    delivered = await db.pallets.count_documents({"status": "delivered"})

    pending_orders = await db.orders.count_documents({"status": "pending"})
    active_loads = await db.loads.count_documents({"status": {"$in": ["loading", "in_transit"]}})
    total_lorries = await db.lorries.count_documents({})
    available_lorries = await db.lorries.count_documents({"status": "available"})

    # Stock by color
    color_pipeline = [
        {"$match": {"status": {"$in": ["in_yard", "in_field"]}}},
        {"$group": {"_id": "$tree_color", "total_quantity": {"$sum": "$quantity"}, "pallet_count": {"$sum": 1}}}
    ]
    color_stock = await db.pallets.aggregate(color_pipeline).to_list(20)

    # Total trees in stock
    total_trees = sum(c["total_quantity"] for c in color_stock)

    return {
        "total_pallets": total_pallets,
        "in_yard": in_yard,
        "in_field": in_field,
        "loaded": loaded,
        "delivered": delivered,
        "pending_orders": pending_orders,
        "active_loads": active_loads,
        "total_lorries": total_lorries,
        "available_lorries": available_lorries,
        "total_trees": total_trees,
        "stock_by_color": [{"color": c["_id"], "quantity": c["total_quantity"], "pallets": c["pallet_count"]} for c in color_stock]
    }

# ── Manifest ─────────────────────────────────────────────────
@api_router.get("/loads/{load_id}/manifest")
async def get_manifest(load_id: str, user=Depends(get_current_user)):
    load = await db.loads.find_one({"_id": ObjectId(load_id)})
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    load_data = serialize_doc(load)
    # Enrich pallet data
    enriched_pallets = []
    for p in load_data.get("pallets", []):
        pallet = await db.pallets.find_one({"_id": ObjectId(p["pallet_id"])})
        if pallet:
            pd = serialize_doc(pallet)
            pd["position"] = p["position"]
            enriched_pallets.append(pd)
    # Get lorry info
    lorry = None
    if load_data.get("lorry_id"):
        lorry_doc = await db.lorries.find_one({"_id": ObjectId(load_data["lorry_id"])})
        if lorry_doc:
            lorry = serialize_doc(lorry_doc)
    return {"load": load_data, "pallets": enriched_pallets, "lorry": lorry}

# ── Root ─────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "Wilson Contractors Tree Management API"}

# ── Startup ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@wilsoncontractors.co.uk")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Wilson2026!")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    # Write credentials
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n## Auth Endpoints\n- POST /api/auth/login\n- POST /api/auth/register\n- GET /api/auth/me\n- POST /api/auth/logout\n")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
