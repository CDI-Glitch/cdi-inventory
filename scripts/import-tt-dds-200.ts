import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const SKUS = [
  { sku: "TT-DDS-200", name: "T Profile Drop Down Sides 200mm Raw Alloy" },
  { sku: "TT-DDS-200-SHB", name: "T Profile Drop Down Sides 200mm Sahara Black" },
  { sku: "TT-DDS-200-W", name: "T Profile Drop Down Sides 200mm Splash White" },
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
        category: "DROP_SIDES",
        unit: "Set",
        reorderPoint: 10,
        active: true,
      },
    });
    console.log(`CREATED: ${item.sku}`);
    created++;
  }

  await prisma.$disconnect();
  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
