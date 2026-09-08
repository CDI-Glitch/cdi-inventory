# Sellable Bundle Shopify Sync

> Companion to `docs/constitution.md` decision 17.
> Status: implemented 2026-08-16. T-Tray BOM data seeded via `scripts/seed-t-tray-bundles.ts`; Shopify IDs still bound in Portal.
> Update 2026-09-07: 挡泥皮 (then `CSM0013`) added to all 12 T-Tray bundles + 2 CMS Hardware Kit shortcut packs (qty 2, `nonConstraining`); moved from `CONSUMABLE` to `FITTING_KIT` category to pass the Bundle-component API gate. Kits/Shopify push unaffected (verified unchanged before/after).
> Update 2026-09-08: renamed `CSM0013` → `DNP` (no `TT-` prefix — also used on Service Body, not Tray-exclusive; reuses the code fragment already embedded in `TT-BN-DNP`, its bolt & nut kit).
> Update 2026-09-08 (panel alt-group, interim measure — see §Panel alt-group below): `TT-PZB` (no-drawer panel) and `TT-MB` (drawer-capable panel) are two separate SKUs. Previously only `TT-PZB` was in the Tray BOM as a single required line, so `TT-PZB` stockout blocked the whole Tray even when `TT-MB` had stock. Fixed by adding `TT-MB` as an `altGroupKey: "panel"` alternative alongside `TT-PZB` in all 12 live T-Tray bundles (same pattern as the existing `mudguard` alt group). Verified before/after: kits for all 12 bundles only increased or stayed the same (never decreased); `BDL-TT-1850-RAW`, `BDL-TT-2150-RAW`, `BDL-TT-2450-RAW` went from 0 kits to 3 kits at Sydney. The Trundle Drawer Shopify addon itself is explicitly **not** changed by this — it stays disconnected from Portal (constant "in stock" on Shopify), a deliberate deferral, not an oversight. See §Panel alt-group for the full reasoning and known limitation.

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
| Mud flap | `DNP`（挡泥皮，2026-09-08 前叫 `CSM0013`）×2 | 2 Each | `nonConstraining`，同上；2026-09-07 从 CONSUMABLE 移入 FITTING_KIT 才能进 BOM；不带 `TT-` 前缀因同时给 Service Body 使用 |
| Number plate / drawer panel | `TT-PZB-SHB` + `TT-MB-SHB` | 1 | alt group `panel`（2026-09-08 起，见下） |
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
| `BDL-TT-1650-RAW` / `-SHB` / `-W` | Dual cab 1650 + headboard |
| `BDL-TT-1850-RAW` / `-SHB` / `-W` | Dual cab 1850 + headboard |
| `BDL-TT-2150-RAW` / `-SHB` / `-W` | Extra cab 2150 + headboard |
| `BDL-TT-2450-RAW` / `-SHB` / `-W` | Single cab 2450 + headboard |

Live sellable kits match that table. Do not keep a second `BND-T-TRAY-…` SKU on the variant — PDP queries `variant.sku`.

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

## Panel alt-group (interim measure, 2026-09-08)

**Problem:** `TT-PZB` (no-drawer panel) and `TT-MB` (drawer-capable panel) are two separate SKUs. Before this change, only `TT-PZB` was in the BOM as a single required line — `TT-PZB` stockout made the whole Tray show out of stock even when `TT-MB` had stock and could physically build the same Tray.

**Fix:** `TT-PZB` and `TT-MB` (same length/colour) now share `altGroupKey: "panel"`, same mechanism as the existing `mudguard` alt group. ATP sums available across both; kits can never be lower than before this change (verified: `BDL-TT-1850-RAW` / `BDL-TT-2150-RAW` / `BDL-TT-2450-RAW` went 0 → 3 kits at Sydney, all other bundles unchanged).

**Fulfillment side unaffected:** the pick-one flow (`SalesAltGroupPicker`, `AltGroupUnresolvedError`) already handles this — staff manually pick `TT-PZB` or `TT-MB` per sales order before Completed, same as `mudguard`. No auto-consumption, no change to reservation control.

**Explicitly out of scope — Trundle Drawer addon:** the Shopify "add a drawer" addon (sizes none/12/14/17) stays a standalone Shopify product with untracked/constant-available inventory, disconnected from Portal. This is a deliberate deferral, not an oversight — reasons:
- The addon and the panel choice are two independent purchase decisions; pooling `TT-PZB`+`TT-MB` for Tray ATP does not need the addon to be honest about `TT-MB`+`VTD` stock to work.
- Making the addon reflect real stock would require new `BundleDefinition` rows (BOM = `TT-MB` + `VTD-{size}`) bound to the addon's Shopify variants — real work, not a side effect of this change.
- Accepted risk: if `TT-PZB` is out and `TT-MB` gets consumed by plain-Tray orders (fallback via the alt group), a customer could still be sold a drawer add-on that can't physically be fulfilled from current stock. Mitigation is operational, not code: `SalesAltGroupPicker` now shows a hint to prefer `TT-PZB` when it has stock, to keep `TT-MB` available for drawer orders. No hard-coded consumption priority — treated like the existing `TT-BN-DNP`/mud-flap style acceptable-substitution risk, follow up with the customer manually if it happens.
- **Known limitation to revisit if it becomes a real problem:** re-evaluate creating `BDL-VTD-{size}` bundles bound to the addon's Shopify variants (same push mechanism as Tray bundles) if drawer-addon overselling actually occurs.

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
