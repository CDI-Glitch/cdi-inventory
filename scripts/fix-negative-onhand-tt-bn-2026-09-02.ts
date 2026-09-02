/**
 * One-off stocktake correction: bring negative On Hand at Brisbane back to 0
 * for TT-BN-DNP / TT-BN-FK / TT-BN-FKT. These went negative from SR-0053
 * completing on 2026-08-28 (01:32 UTC), 3 days BEFORE the hard stock lock
 * shipped in completeStock() (commit 276eb6a, 2026-08-31 07:10 UTC) — this
 * is pre-lock legacy residue, not a bypass of the current code (verified:
 * zero sales_deduction rows on these SKUs since the lock deployed).
 *
 * Writes a positive `stocktake_correction` InventoryLog per SKU with
 * delta = abs(current on-hand), so resulting on-hand = exactly 0. Does not
 * fabricate extra stock — SR-0076 (which reserves 1 of each) will still
 * need real stock received before it can be marked completed.
 *
 * Reserved / GeneratedMovement / sales records are untouched.
 *
 * Run: npx tsx scripts/fix-negative-onhand-tt-bn-2026-09-02.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

const TARGET_SKUS = ["TT-BN-DNP", "TT-BN-FK", "TT-BN-FKT"];

async function main() {
  const brisbane = await prisma.location.findFirst({ where: { name: { contains: "Brisbane" } } });
  if (!brisbane) throw new Error("Brisbane location not found");

  for (const sku of TARGET_SKUS) {
    const product = await prisma.product.findUnique({ where: { sku } });
    if (!product) {
      console.log(`SKIP: ${sku} not found`);
      continue;
    }

    const sum = await prisma.inventoryLog.aggregate({
      where: { productId: product.id, locationId: brisbane.id },
      _sum: { delta: true },
    });
    const onHand = sum._sum.delta ?? 0;

    if (onHand >= 0) {
      console.log(`SKIP: ${sku} on-hand already ${onHand} (not negative)`);
      continue;
    }

    const correction = -onHand; // positive amount to bring back to 0

    await prisma.inventoryLog.create({
      data: {
        productId: product.id,
        locationId: brisbane.id,
        type: "stocktake_correction",
        delta: correction,
        reference: "BNE-NEG-FIX-2026-09-02",
        enteredBy: "admin-correction-2026-09-02",
        notes: `Data correction: SR-0053 completed 2026-08-28 (pre-lock, 3 days before completeStock() advisory-lock shipped 2026-08-31). Was ${onHand}, corrected to 0.`,
      },
    });

    console.log(`FIXED: ${sku} ${onHand} -> 0 (delta +${correction})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
