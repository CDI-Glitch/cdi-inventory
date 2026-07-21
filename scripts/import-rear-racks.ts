import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  { sku: "CD-RR-1775-300-SHB", name: "T Tray Rear Rack 1775 x 300 Sahara Black", qty: 0, reorderPoint: 10 },
  { sku: "CD-RR-1775-300-W",   name: "T Tray Rear Rack 1775 x 300 Splash White", qty: 0, reorderPoint: 10 },
  { sku: "CD-RR-1775-300",     name: "T Tray Rear Rack 1775 x 300 Raw Alloy",     qty: 0, reorderPoint: 10 },
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
        category: "REAR_RACK",
        unit: "Each",
        reorderPoint: item.reorderPoint,
        active: true,
      },
    });

    process.stdout.write(`✅ ${item.sku} | ${item.name} | reorder: ${item.reorderPoint}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
