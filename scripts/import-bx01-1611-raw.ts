/**
 * Add Raw Alloy (no colour suffix) for BX01-1611 LHS/RHS.
 * Run: npx tsx scripts/import-bx01-1611-raw.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const SKUS = [
  {
    sku: "BX01-1611-L",
    name: "C-Profile Underbody Toolbox 1611 LHS Raw Alloy",
  },
  {
    sku: "BX01-1611-R",
    name: "C-Profile Underbody Toolbox 1611 RHS Raw Alloy",
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
        category: "UNDERBODY_TOOLBOX",
        unit: "Each",
        reorderPoint: 5,
        active: true,
      },
    });
    console.log(`CREATED: ${item.sku} | ${item.name}`);
    created++;
  }

  await prisma.$disconnect();
  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
