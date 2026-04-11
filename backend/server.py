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
    return {"id": uid, "email": email, "name": user.get("name", ""), "role": user.get("role", "viewer"), "token": access}

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
# Stock is tracked per colour. QR codes are per colour (printed in rolls).
# Quantity goes up when pallets arrive from field, down when loaded.

class StockAdjust(BaseModel):
    color: str
    change: int  # positive = pallets in, negative = pallets out
    notes: Optional[str] = None

class ColorCreate(BaseModel):
    color: str
    label: Optional[str] = None  # display label e.g. "Nordmann Green"

@api_router.get("/colours")
async def list_colours(user=Depends(get_current_user)):
    """List all colour codes with current stock"""
    colours = await db.colours.find().sort("color", 1).to_list(50)
    result = []
    for c in colours:
        cd = serialize_doc(c)
        result.append(cd)
    return result

@api_router.post("/colours")
async def create_colour(data: ColorCreate, user=Depends(get_current_user)):
    existing = await db.colours.find_one({"color": data.color.lower().strip()})
    if existing:
        raise HTTPException(status_code=400, detail="Colour already exists")
    doc = {
        "color": data.color.lower().strip(),
        "label": data.label or data.color.capitalize(),
        "quantity": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.colours.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@api_router.delete("/colours/{colour_id}")
async def delete_colour(colour_id: str, user=Depends(get_current_user)):
    await db.colours.delete_one({"_id": ObjectId(colour_id)})
    return {"message": "Deleted"}

@api_router.post("/stock/adjust")
async def adjust_stock(adj: StockAdjust, user=Depends(get_current_user)):
    """Add or remove pallets for a colour. Positive = in, negative = out."""
    color = adj.color.lower().strip()
    colour_doc = await db.colours.find_one({"color": color})
    if not colour_doc:
        raise HTTPException(status_code=404, detail=f"Colour '{color}' not found. Add it first.")
    new_qty = colour_doc.get("quantity", 0) + adj.change
    if new_qty < 0:
        raise HTTPException(status_code=400, detail=f"Not enough stock. Current: {colour_doc.get('quantity', 0)}")
    await db.colours.update_one({"color": color}, {"$set": {"quantity": new_qty}})
    # Log the movement
    movement = {
        "color": color,
        "change": adj.change,
        "type": "in" if adj.change > 0 else "out",
        "quantity_after": new_qty,
        "notes": adj.notes or "",
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stock_movements.insert_one(movement)
    return {"color": color, "quantity": new_qty, "change": adj.change}

@api_router.get("/stock/movements")
async def list_stock_movements(color: Optional[str] = None, limit: int = 50, user=Depends(get_current_user)):
    query = {}
    if color:
        query["color"] = color.lower().strip()
    movements = await db.stock_movements.find(query).sort("created_at", -1).to_list(limit)
    return [serialize_doc(m) for m in movements]

# ── QR Code Endpoint (per colour) ────────────────────────────
@api_router.get("/colours/{color}/qr")
async def get_colour_qr(color: str, user=Depends(get_current_user)):
    import qrcode
    colour_doc = await db.colours.find_one({"color": color.lower().strip()})
    if not colour_doc:
        raise HTTPException(status_code=404, detail="Colour not found")
    qr_data = f"WC-TMS|COLOR:{color.upper()}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return {"qr_base64": base64.b64encode(buf.read()).decode(), "qr_data": qr_data, "color": color, "label": colour_doc.get("label", color)}

# ── Yard Locations ───────────────────────────────────────────
class YardLocationCreate(BaseModel):
    name: str
    section: str = "A"
    capacity: int = 20
    description: Optional[str] = None
    bounds: Optional[list] = None
    colorIndex: Optional[int] = None

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
    """Returns available stock by colour"""
    colours = await db.colours.find().to_list(50)
    stock = {}
    for c in colours:
        stock[c["color"]] = {"color": c["color"], "label": c.get("label", c["color"]), "quantity": c.get("quantity", 0)}
    return stock

@api_router.post("/orders/{order_id}/check-fulfillment")
async def check_order_fulfillment(order_id: str, user=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    results = []
    can_fulfill = True
    for item in order.get("items", []):
        colour_doc = await db.colours.find_one({"color": item["tree_color"].lower().strip()})
        avail_qty = colour_doc.get("quantity", 0) if colour_doc else 0
        ok = avail_qty >= item["quantity"]
        if not ok:
            can_fulfill = False
        results.append({"tree_color": item["tree_color"], "requested": item["quantity"], "available": avail_qty, "can_fulfill": ok})
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

# ── Collections (Loads) ──────────────────────────────────────
class LoadDestination(BaseModel):
    address: str
    notes: Optional[str] = None

class PalletRequirement(BaseModel):
    color: str
    quantity: int

class LoadCreate(BaseModel):
    lorry_id: Optional[str] = None
    destinations: List[LoadDestination]
    departure_date: Optional[str] = None
    driver_name: Optional[str] = None
    notes: Optional[str] = None
    pallets_required: Optional[List[PalletRequirement]] = None

class LoadUpdate(BaseModel):
    status: Optional[str] = None
    destinations: Optional[List[LoadDestination]] = None
    notes: Optional[str] = None
    pallets_required: Optional[List[PalletRequirement]] = None

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
    if "destinations" in updates:
        updates["destinations"] = [d if isinstance(d, dict) else d.model_dump() for d in updates["destinations"]]
    if "pallets_required" in updates:
        updates["pallets_required"] = [p if isinstance(p, dict) else p.model_dump() for p in updates["pallets_required"]]
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.loads.update_one({"_id": ObjectId(load_id)}, {"$set": updates})
    # If dispatched, deduct stock
    if updates.get("status") == "in_transit":
        load = await db.loads.find_one({"_id": ObjectId(load_id)})
        if load:
            for p in load.get("pallets_required", []):
                color = p.get("color", "").lower().strip()
                qty = p.get("quantity", 0)
                if color and qty > 0:
                    await db.colours.update_one({"color": color}, {"$inc": {"quantity": -qty}})
                    await db.stock_movements.insert_one({
                        "color": color, "change": -qty, "type": "out",
                        "quantity_after": 0, "notes": f"Dispatched — collection {load_id}",
                        "user_id": "", "user_name": "System",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
    load = await db.loads.find_one({"_id": ObjectId(load_id)})
    return serialize_doc(load)

# ── Dashboard Stats ──────────────────────────────────────────
@api_router.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    colours = await db.colours.find().to_list(50)
    total_pallets = sum(c.get("quantity", 0) for c in colours)
    pending_orders = await db.orders.count_documents({"status": "pending"})
    active_collections = await db.loads.count_documents({"status": {"$in": ["loading", "in_transit"]}})
    delivered_collections = await db.loads.count_documents({"status": "delivered"})

    return {
        "total_pallets": total_pallets,
        "pending_orders": pending_orders,
        "active_collections": active_collections,
        "delivered_collections": delivered_collections,
        "total_trees": total_pallets * 100,
        "stock_by_color": [{"color": c.get("color",""), "quantity": c.get("quantity",0)} for c in colours]
    }

# ── Manifest ─────────────────────────────────────────────────
@api_router.get("/loads/{load_id}/manifest")
async def get_manifest(load_id: str, user=Depends(get_current_user)):
    load = await db.loads.find_one({"_id": ObjectId(load_id)})
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    load_data = serialize_doc(load)
    enriched_pallets = load_data.get("pallets", [])
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
