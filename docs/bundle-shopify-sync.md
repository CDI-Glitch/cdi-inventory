# Sellable Bundle Shopify Sync

> Companion to `docs/constitution.md` decision 17.
> Status: implemented 2026-08-16. T-Tray BOM data seeded via `scripts/seed-t-tray-bundles.ts`; Shopify IDs still bound in Portal.

---

## What this is

Shopify Tray products are **not** physical SKUs in Portal inventory. They are kits. Portal keeps component stock as today, derives **kits** from the live BOM, caches that number per warehouse, and pushes it to the Shopify variant.

Hardware shortcut packs (`BDL-CMS-HW-*`) stay as they are: no `sellableSku`, not pushed to Shopify.

---

## Model

| Field | On | Meaning |
|---|---|---|
| `sellableSku` | `BundleDefinition` | Storefront / Worker lookup key. Unique when set. |
| `shopifyInventoryItemId` / `shopifyVariantId` | `BundleDefinition` | Shopify binding. No shell `Product` row. |
| `nonConstraining` | `BundleItem` | In pick/reserve BOM; **excluded** from kits ATP (fasteners). |
| `altGroupKey` | `BundleItem` | Same key in one bundle = interchangeable. ATP **sums** available. Warehouse picks which SKU. |
| `BundleLocationStock.cachedKits` | per bundle × location | PDP reads this. Recalculated on component stock change. |

ATP formula per warehouse:

```
for each constraining group (alt group or single required line):
  kits_from_group = floor(sum(available of SKUs in group) / qtyPerKit)
kits = MIN(kits_from_group)
```

`available = onHand − reserved` (same as SKU ATP). `nonConstraining` and `required=false` lines are skipped.

---

## T-Tray template (locked)

Sizes 1650 / 1850 / 2150 / 2450 × colours Raw Alloy (no suffix) / Sahara Black (`-SHB`) / Splash White (`-W`).

Example: **1850 Sahara Black**

| Line | SKU | Qty | ATP |
|---|---|---|---|
| Deck | `T-Tray-1805-SHB` | 1 | single |
| Headboard | `TT-HB-SHB` | 1 | single |
| Mudguard | `CD-MG-SHB` + `CD-MG-DT-SHB` + `CD-MG-HR-SHB` | 1 pair | alt group `mudguard` |
| Rear tie-down | `TT-BSG-89-SHB` | 1 pair | single |
| Toolbox L/R | `TT-BX-90-L-SHB` / `TT-BX-90-R-SHB` | 1 each | single |
| Fitting kit | `FK` ×3（2450 为 ×4）+ `CXH` ×1 | — | 卡 kits。`FK-Ex` 不进 BOM，偶发在 fulfillment 手动加 |
| Fitting kit 螺丝 | 全部 `TT-BN-*` 各 ×1 | 1 Each | `nonConstraining`：预留/领料要减，网站不算 |
| Number plate | `TT-PZB-SHB` | 1 | single |
| Tail light panel | `TT-WDB-SHB` | 1 pair | single |

Bar/box grouping is independent of FK count:

| Size | Deck | Bars / boxes | FK |
|---|---|---|---|
| 1650 | `T-Tray-1605` | `TT-BSG-67` / `TT-BX-68` | 3 |
| 1850 | `T-Tray-1805` | `TT-BSG-89` / `TT-BX-90` | 3 |
| 2150 | `T-Tray-2105` | `TT-BSG-89` / `TT-BX-90` | 3 |
| 2450 | `T-Tray-2405` | `TT-BSG-67` / `TT-BX-68` | 4 |

Seed codes: `BDL-TT-{size}-RAW` / `-SHB` / `-W`. Live Shopify variant SKU = the same Portal code:

| Portal / Shopify SKU | Meaning |
|---|---|
| `BDL-TT-1650-SHB` / `-W` | Dual cab 1650 + headboard |
| `BDL-TT-1850-SHB` / `-W` | Dual cab 1850 + headboard |
| `BDL-TT-2450-SHB` / `-W` | Single cab 2450 + headboard |

Raw alloy, 2150 extra cab, and Inventory Item IDs are not bound until those variants go live. Do not keep a second `BND-T-TRAY-…` SKU on the variant — PDP queries `variant.sku`.

---

## How Shopify and the PDP get stock

```
component InventoryLog / GeneratedMovement change
  → afterStockChange(productIds)
  → sync linked Product SKUs
  → refresh BundleLocationStock for every bundle using those products
  → inventorySetQuantities for linked BundleDefinition variants

PDP / Worker GET /api/internal/inventory?sku=
  → Product.sku if found (live onHand − reserved)
  → else BundleDefinition.sellableSku → cachedKits (no live BOM walk)
```

Do not live-calculate BOM on the public Worker path.

---

## Shared-component window (accepted)

Shopify variants each store their own available qty. `FK` is shared across colours. Until a Portal reservation exists, two colours can both show kits > 0 against the same physical piece.

Mitigation now: Dashboard **Shared kit bottleneck** when one constraining group is the MIN for ≥ 2 sellable bundles at a location. Process those Shopify orders into Portal reservations quickly.

Not in this cut: webhook auto-create sales + reserve (second cut).

---

## Reservation vs ATP

| Flag | ATP | `reserveStock` / snapshot |
|---|---|---|
| normal line | constrains kits | reserved |
| `nonConstraining` | ignored | reserved (pick list) |
| `altGroupKey` set | sum of group | **not** auto-reserved — warehouse picks one SKU on fulfillment. Portal shows a pick-one control per `(sales line, alt group)` and **blocks Completed** until reserved qty for that group meets `qty × line.qty`. |

Soft BOM is unchanged: saving a sales line still snapshots items. Editing the live definition does not rewrite existing quotes.

---

## Shopify `orders/paid` (current, not constitution-F as originally written)

`handleOrderPaid` matches an existing Portal sales record (invoice / order name) and stores `shopifyOrderId`. It does **not** create a `SalesRecord`, explode a Tray SKU, or reserve components. Checkout still uses last pushed Shopify qty. Oversell window = time until staff reserve in Portal.

---

## Deferred

- Other tray families (schema already supports new `BundleDefinition` rows)
- Auto-reserve from Shopify webhook
- Vehicle-fit mudguard pick (`CD-MG-DT` / `HR`) from PDP vehicle field
- Safety buffer (subtract 1 kit) — rejected in favour of the dashboard alert

---

## Ops

Portal: `sales` / `editor` / `admin` can open Bundles to learn BOM; only `admin` can create, edit, or bind Shopify IDs.

```bash
npx prisma migrate deploy
npx tsx scripts/seed-t-tray-bundles.ts
```

Then on each bundle: set `sellableSku` to the Shopify variant SKU and paste Inventory Item ID. Run Settings → Shopify sync once, or wait for the next component stock change.
