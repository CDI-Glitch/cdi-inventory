/**
 * Add European-standard spring nut 30*M6 (pair to existing CSM0010 30*M8).
 * Run: npx tsx scripts/import-csm0044-spring-nut-m6.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const SKUS = [
  {
    sku: "CSM0044",
    name: "欧标弹片螺母30*M6",
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
        category: "CONSUMABLE",
        unit: "Each",
        reorderPoint: 50,
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
