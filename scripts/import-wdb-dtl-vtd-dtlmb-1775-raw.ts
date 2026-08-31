/**
 * Add Raw Alloy (no colour suffix) for WDB-DTL and VTD-DTLMB-1775.
 * Run: npx tsx scripts/import-wdb-dtl-vtd-dtlmb-1775-raw.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const SKUS = [
  {
    sku: "WDB-DTL",
    name: "C Profile Devil Tail Light Panel Raw Alloy",
    category: "CHASSIS_PANEL",
    unit: "Pair",
    reorderPoint: 5,
  },
  {
    sku: "VTD-DTLMB-1775",
    name: "C Profile VTD Drawer Panel Raw Alloy",
    category: "CHASSIS_PANEL",
    unit: "Each",
    reorderPoint: 5,
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  } as any);

  let created = 0;
  let skipped = 0;

  for (const item of SKUS) {
    const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (existing) {
      console.log(`SKIP (exists): ${item.sku}`);
      skipped++;
      continue;
    }
    await prisma.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        category: item.category,
        unit: item.unit,
        reorderPoint: item.reorderPoint,
        active: true,
      },
    });
    console.log(`CREATED: ${item.sku} | ${item.name} | ${item.unit} | reorder ${item.reorderPoint}`);
    created++;
  }

  await prisma.$disconnect();
  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
