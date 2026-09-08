/**
 * Add DSX-40L — 40L Stainless Steel Under Body Water Tank.
 * New category: WATER_TANK (first SKU in this category).
 * No opening stock (0 on hand at import).
 *
 * Run: npx tsx scripts/import-dsx-40l-water-tank.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  {
    sku: "DSX-40L",
    name: "40L Stainless Steel Under Body Water Tank",
    category: "WATER_TANK",
    unit: "Each",
    reorderPoint: 5,
  },
];

async function main() {
  for (const item of SKUS) {
    const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (existing) {
      console.log(`SKIP (exists): ${item.sku}`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        category: item.category,
        unit: item.unit,
        reorderPoint: item.reorderPoint,
        active: true,
      },
    });

    console.log(
      `✅ ${product.sku} | ${product.name} | category: ${product.category} | reorder: ${product.reorderPoint} | qty: 0`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
