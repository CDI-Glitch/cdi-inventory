import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  // T-Profile Tail Light Panel
  { sku: "TWDB-TL-SHB",  name: "T Profile Tail Light Panel Sahara Black",          qty: 5, reorderPoint: 10 },
  { sku: "TWDB-TL-W",    name: "T Profile Tail Light Panel Splash White",           qty: 0, reorderPoint: 10 },
  { sku: "TWDB-TL",      name: "T Profile Tail Light Panel Raw Alloy",              qty: 0, reorderPoint: 10 },
  // C-Profile Devil Tail Light Panel
  { sku: "CWDB-DTL-SHB", name: "C Profile Devil Tail Light Panel Sahara Black",    qty: 6, reorderPoint: 10 },
  { sku: "CWDB-DTL-W",   name: "C Profile Devil Tail Light Panel Splash White",    qty: 4, reorderPoint: 5  },
];

async function main() {
  const brisbane = await prisma.location.findFirst({
    where: { name: { contains: "Brisbane" } },
  });
  if (!brisbane) { process.stdout.write("ERROR: Brisbane location not found\n"); return; }
  process.stdout.write(`Location: ${brisbane.name}\n\n`);

  let created = 0, skipped = 0;

  for (const item of SKUS) {
    const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (existing) {
      process.stdout.write(`SKIP (exists): ${item.sku}\n`);
      skipped++;
      continue;
    }

    const product = await prisma.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        category: "CHASSIS_PANEL",
        unit: "Pair",
        reorderPoint: item.reorderPoint,
        active: true,
      },
    });

    if (item.qty > 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: product.id,
          locationId: brisbane.id,
          type: "opening_stock",
          delta: item.qty,
          enteredBy: "import",
          notes: "Opening stock on import",
        },
      });
    }

    process.stdout.write(`✅ ${item.sku} | ${item.name} | unit: Pair | qty: ${item.qty} | reorder: ${item.reorderPoint}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
