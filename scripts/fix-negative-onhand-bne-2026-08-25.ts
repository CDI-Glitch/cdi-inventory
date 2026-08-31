/**
 * One-off stocktake correction: bring negative On Hand at Brisbane back to 0
 * for the 9 SKUs identified 2026-08-25 (legacy over-completion before the
 * hard stock lock was added to completeStock()). Does NOT touch Sydney.
 *
 * Writes a positive `stocktake_correction` InventoryLog per SKU with
 * delta = abs(current on-hand), so resulting on-hand = exactly 0.
 * Reserved / GeneratedMovement / sales records are untouched.
 *
 * Run: npx tsx scripts/fix-negative-onhand-bne-2026-08-25.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

const TARGET_SKUS = [
  "CD-MG-HR",
  "CD-MG-DT",
  "TT-BN-FK",
  "TT-BN-FKT",
  "TT-BN-DNP",
  "CD-2D-17158",
  "TT-BN-BX/MG",
  "4122*1800-SHB",
  "TT-BN-BSG",
];

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
        reference: "BNE-NEG-FIX-2026-08-25",
        enteredBy: "admin-correction-2026-08-25",
        notes: `Data correction: legacy over-completion before hard stock lock (2026-08-25). Was ${onHand}, corrected to 0.`,
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
