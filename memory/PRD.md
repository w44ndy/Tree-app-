# Wilson Contractors - Tree Management System (TMS)

## Original Problem Statement
App for Wilson Contractors managing Christmas trees — from pallets collected at the field, stored at Mains of Corsindae, assigned to loads, then collected with lorries. Track stock and locations in the yard, input orders, check stock fulfillment, load lorries, select pallet locations. Multiple destinations per load. Desktop and iPad responsive. Print manifests. Trees grouped by colour. Clear dashboard for owner in London with live camera feed option.

## Business Rules
- 1 Pallet = 100 Trees
- Tracked by Colour (not individual pallet IDs)
- TMS branding (TMS.wilson-contractors.co.uk) with Wilson Contractors Logo

## Tech Stack
- Frontend: React + Tailwind + Shadcn UI
- Backend: FastAPI + MongoDB (Motor)
- Additional: react-leaflet, react-signature-canvas, recharts

## Pages
| Page | Route | Status |
|------|-------|--------|
| Login | /login | Done |
| Dashboard | / | Done |
| TV Dashboard | /tv-dashboard | Done |
| Field (Inbound) | /field | Done |
| Stock (Colours) | /pallets | Done |
| Collections (Outbound) | /loads | Done |
| Manifest (Printable) | /manifest/:loadId | Done |
| Yard Map | (in sidebar? TBD) | Done (YardPage.js exists) |

## Key DB Collections
- `users`: {email, name, password_hash, role}
- `colours`: {name, hex, quantity, tree_count}
- `locations`: {name, capacity, colorIndex, points, stock}
- `loads`: {hauler, collection_date, destinations, pallets_required, status, driver_name, registration, signature, dispatched_at}
- `haulers`: {name}
- `field_collections`: {date, user_id, user_name, pallets, total_pallets, notes}

## Completed Features
- JWT Authentication & Admin seeding
- Wilson Contractors branding throughout
- Dashboard with analytics (7-day requirements, stock charts, hauler stats)
- TV Dashboard — fullscreen dark-themed page for office TV (auto-refresh 30s, no sidebar)
- Field Page — tap interface for inbound pallets
- Stock Page — manage colours and quantities
- Collections Page — scheduling, inline driver signatures, haulers CRUD, edit/delete
- Manifest Page — printable with driver info, signature, check-off boxes
- Yard Map — iPad-compatible static satellite map drawing tool (Corsindae)

## Pending / Blocked
- Reolink Camera feed — BLOCKED waiting for user to provide IP/RTSP details

## Backlog
- QR coding for pallets (if needed)
- Further Yard Map enhancements
- Additional reporting / export features

## Auth Credentials
- Admin: admin@wilsoncontractors.co.uk / Wilson2026!
- Test: test / test
