# CDI Inventory Portal

Internal inventory management system for CDI. Handles online/offline orders, stock reservation, incoming shipments, inter-warehouse transfers, and one-way Shopify sync.

**Production:** https://cdi-inventory-production.up.railway.app  
**Repo:** https://github.com/CDI-Glitch/cdi-inventory

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | PostgreSQL (Railway) |
| ORM | Prisma 7 + pg driver adapter |
| Auth | NextAuth.js v5 — Credentials + JWT |
| UI | Tailwind CSS v4 + Lucide icons |
| Deployment | Railway (auto-deploy on push to `main`) |

---

## Local Development

### Prerequisites
- Node.js 20+
- A PostgreSQL database (Railway dev DB, or local)

### Setup

```bash
# 1. Clone and install
git clone https://github.com/CDI-Glitch/cdi-inventory.git
cd cdi-inventory
npm install

# 2. Create .env file
cp .env.example .env   # then fill in values (see below)

# 3. Generate Prisma client
npx prisma generate

# 4. Apply migrations + seed initial data
npx prisma migrate deploy
npm run db:seed

# 5. Start dev server
npm run dev
# → http://localhost:3000
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# NextAuth
NEXTAUTH_SECRET=any-random-32-char-string
NEXTAUTH_URL=http://localhost:3000

# Shopify (optional — only needed for sync feature)
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxxx
```

### Seed Credentials (dev only)

After `npm run db:seed`:

| Email | Password | Role |
|---|---|---|
| admin@cdi.com | admin123 | Admin |
| editor@cdi.com | editor123 | Editor |
| viewer@cdi.com | viewer123 | Viewer |

---

## Project Structure

```
src/
├── app/
│   ├── (portal)/          # Authenticated portal pages
│   │   ├── dashboard/
│   │   ├── inventory/     # SKU list, detail, adjust, new
│   │   ├── sales/         # Sales records, new, detail
│   │   ├── bundles/       # Bundle definitions, new, edit
│   │   ├── incoming/      # Incoming shipments, new, detail
│   │   ├── transfers/     # Stock transfers, new, detail
│   │   ├── audit-log/     # Full inventory log viewer
│   │   └── settings/      # Users, Locations, Shopify Sync
│   ├── api/               # API routes
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── bundles/
│   │   ├── incoming/
│   │   ├── transfers/
│   │   ├── users/
│   │   ├── locations/
│   │   ├── sync/
│   │   └── webhooks/shopify/
│   └── login/
├── components/
│   ├── inventory/
│   ├── sales/
│   ├── bundles/
│   ├── incoming/
│   ├── transfers/
│   ├── settings/
│   └── sidebar.tsx
├── lib/
│   ├── auth.ts            # NextAuth config
│   ├── auth.config.ts     # trustHost + pages config
│   ├── db.ts              # Prisma client singleton
│   ├── constants.ts       # Enums, status transitions
│   └── shopify-sync.ts    # Shopify Admin API sync logic
└── generated/prisma/      # Auto-generated Prisma client (do not edit)
```

---

## Key Concepts

### Inventory Model

Stock is never stored as a single number. It is **computed from `InventoryLog` entries**:

```
onHand    = SUM of all deltas for a (product, location)
reserved  = SUM of GeneratedMovement.reservedQty for active sales (deposit_paid / fully_paid)
available = onHand - reserved
```

All stock changes (receive, adjust, transfer, sales deduction) write an `InventoryLog` row. This is the audit trail.

### Sales Record State Machine

```
quote → deposit_paid → fully_paid → completed
  ↓           ↓             ↓
cancelled  cancelled    cancelled
```

- `deposit_paid`: reserves stock via `GeneratedMovement`
- `fully_paid`: inventory deducted (writes `sales_deduction` log), reservation released
- `cancelled`: reservation released (reservation logs reversed)

### Incoming Shipment Flow

```
pending → shipped → in_transit → arrived → confirmed
   ↓          ↓          ↓           ↓
cancelled  cancelled  cancelled  cancelled
```

- `confirmed`: writes `receive_stock` InventoryLog for each line (qty = qtyReceived)

### Transfer Flow

```
pending → in_transit → completed
   ↓           ↓
cancelled   cancelled
```

- `completed`: writes `transfer_out` (from location) + `transfer_in` (to location) logs

### Bundle Expansion

When a Sales Record's `itemCode` matches a `BundleDefinition.code`, creating/moving to `deposit_paid` expands into individual component `GeneratedMovement` rows, one per bundle item.

---

## Database

### Migrations

```bash
# Apply all pending migrations (safe for production)
npx prisma migrate deploy

# Create a new migration after schema changes (dev only)
npx prisma migrate dev --name describe_your_change

# If migrate dev fails (non-interactive env), create SQL manually:
# 1. Write SQL in prisma/migrations/<timestamp>_name/migration.sql
# 2. npx prisma db execute --file prisma/migrations/.../migration.sql --schema prisma/schema.prisma
# 3. npx prisma migrate resolve --applied <migration-name>
# 4. npx prisma generate
```

### Reseed (dev only — DESTRUCTIVE)

```bash
npm run db:seed
```

---

## Deployment (Railway)

Deploys automatically on every push to `main`.

Build command: `prisma generate && next build`  
Start command: `next start`

### Required Railway Environment Variables

```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL          # must include https:// prefix
SHOPIFY_SHOP_DOMAIN   # optional
SHOPIFY_ADMIN_API_TOKEN # optional
```

### Manual redeploy

Push any commit to `main`, or click "Deploy" in the Railway dashboard.

---

## Roles & Permissions

| Feature | Viewer | Editor | Admin |
|---|---|---|---|
| View inventory / sales / dashboard | ✅ | ✅ | ✅ |
| Adjust stock / create sales | ❌ | ✅ | ✅ |
| Incoming shipments / transfers | ❌ | ✅ | ✅ |
| Bundles / Audit Log / Settings | ❌ | ❌ | ✅ |

---

## Shopify Integration

### Webhooks (Shopify → Portal)

`POST /api/webhooks/shopify`

- `orders/paid`: links Shopify order ID to matching Sales Record
- `orders/cancelled`: releases reservation on matched Sales Record
- HMAC-verified; idempotent via `ProcessedWebhook` table

Register in Shopify Admin: **Settings → Notifications → Webhooks**

### Sync (Portal → Shopify)

Triggered manually from **Settings → Shopify Sync → Sync now**, or `POST /api/sync`.

Updates Shopify inventory level for each product that has:
- `shopifyInventoryItemId` set on the Product record
- `shopifyVariantId` set on the Product record  
- `shopifyLocationId` set on the Location record

Set these in **Inventory → [SKU] → Edit** and **Settings → Locations**.

---

## Common Tasks

### Add a new user
Settings → Users → Add user

### Add a new warehouse location
Settings → Locations → Add location  
Then optionally link a Shopify Location ID for sync.

### Add a new SKU
Inventory → New SKU  
Then use "Adjust Stock" to set opening stock.

### Create a bundle
Bundles → New Bundle  
Add component SKUs with quantities and roles.

### Receive new stock
Incoming → New Shipment → fill PO details → add lines → move through status flow → Confirm  
On Confirm, stock is automatically added to inventory.

---

## Known Limitations / Future Work

- Shopify sync requires manual trigger (no auto-sync on stock change)
- No CSV export for audit log or sales records yet
- Password reset is admin-only (via Settings → Users)
- No email notifications on low stock or order events
