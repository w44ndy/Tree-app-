# Wilson Contractors - Tree Management System (TMS)
## Original Problem Statement
App for Wilson Contractors managing Christmas trees — pallets collected at field, stored at Mains of Corsindae, assign pallets to loads, collection with lorries. Stock/location visibility in yard, order input with stock checking, lorry loading with pallet positions, multiple destinations per load. Desktop + iPad. Print manifests, QR coding pallets. Trees grouped by colour. Dashboard for owner in London with live camera feed.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT httpOnly cookies, bcrypt, role-based (admin, yard_manager, driver)
- **Domain**: TMS.wilson-contractors.co.uk

## User Personas
- **Owner (London)**: Dashboard view, KPIs, live camera, order oversight
- **Yard Manager**: Pallet CRUD, yard locations, stock management, order fulfillment
- **Driver**: Load viewing, manifest access, delivery status updates

## What's Been Implemented (2026-04-11)
- Auth (login/logout, admin seeding, JWT cookies)
- Dashboard with KPIs, stock charts (bar/pie), live camera feed widget
- Pallet management (CRUD, color-coded, QR code generation)
- Yard & Stock (locations, stock overview by colour, capacity tracking)
- Order management (multi-item orders, stock fulfillment checking)
- Load management (multi-destination, lorry assignment)
- Lorry loading map (2D grid for pallet positioning)
- Manifest viewing/printing
- Lorry fleet management
- Wilson Contractors branding (logo from website, TMS subdomain)

## Prioritized Backlog
### P0 (Next)
- iPad-optimized responsive sidebar (collapsible hamburger menu)
- Live camera stream URL configuration (replace mock image)

### P1
- User management (create yard_manager/driver accounts)
- QR code scanning via iPad camera
- Pallet batch import from CSV

### P2
- Delivery tracking with GPS
- Customer portal for order status
- Historical reporting & analytics
- Email notifications for order/delivery status
