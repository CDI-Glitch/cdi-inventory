/**
 * Add CL-WTL: whale-tail lock with central locking (canopy accessory).
 * Run: npx tsx scripts/import-cl-wtl.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const SKUS = [
  {
    sku: "CL-WTL",
    name: "Whale Tail Lock with Central Locking",
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
        category: "CANOPY_ACCESSORY",
        unit: "Each",
        reorderPoint: 10,
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
