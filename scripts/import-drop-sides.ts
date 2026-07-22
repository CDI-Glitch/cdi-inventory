import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  { sku: "TT-DDS-400-SHB",  name: "T Profile Drop Down Sides 400mm Sahara Black",  reorderPoint: 10 },
  { sku: "TT-DDS-400-W",    name: "T Profile Drop Down Sides 400mm Splash White",   reorderPoint: 10 },
  { sku: "TT-DDS-400",      name: "T Profile Drop Down Sides 400mm Raw Alloy",      reorderPoint: 10 },
  { sku: "TT-DDS-600-SHB",  name: "T Profile Drop Down Sides 600mm Sahara Black",  reorderPoint: 10 },
  { sku: "TT-DDS-600-W",    name: "T Profile Drop Down Sides 600mm Splash White",   reorderPoint: 10 },
  { sku: "TT-DDS-600",      name: "T Profile Drop Down Sides 600mm Raw Alloy",      reorderPoint: 10 },
  { sku: "TT-DDS-1800-SHB", name: "T Profile Drop Down Sides 1800mm Sahara Black", reorderPoint: 10 },
  { sku: "TT-DDS-1800-W",   name: "T Profile Drop Down Sides 1800mm Splash White",  reorderPoint: 10 },
  { sku: "TT-DDS-1800",     name: "T Profile Drop Down Sides 1800mm Raw Alloy",     reorderPoint: 10 },
];

async function main() {
  let created = 0, skipped = 0;

  for (const item of SKUS) {
    const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (existing) {
      process.stdout.write(`SKIP (exists): ${item.sku}\n`);
      skipped++;
      continue;
    }

    await prisma.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        category: "DROP_SIDES",
        unit: "Set",
        reorderPoint: item.reorderPoint,
        active: true,
      },
    });

    process.stdout.write(`✅ ${item.sku} | ${item.name}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
