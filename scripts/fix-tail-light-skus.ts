import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

// Wrong SKUs to delete (imported last round with incorrect naming)
const WRONG_SKUS = ["TWDB-TL-SHB", "TWDB-TL-W", "TWDB-TL", "CWDB-DTL-SHB", "CWDB-DTL-W"];

// Correct SKUs from Excel
const CORRECT_SKUS = [
  { sku: "TT-WDB-SHB",  name: "T Profile Tail Light Panel Sahara Black",       qty: 5, reorderPoint: 10 },
  { sku: "TT-WDB-W",    name: "T Profile Tail Light Panel Splash White",        qty: 0, reorderPoint: 10 },
  { sku: "TT-WDB",      name: "T Profile Tail Light Panel Raw Alloy",           qty: 0, reorderPoint: 10 },
  { sku: "WDB-DTL-SHB", name: "C Profile Devil Tail Light Panel Sahara Black",  qty: 6, reorderPoint: 10 },
  { sku: "WDB-DTL-W",   name: "C Profile Devil Tail Light Panel Splash White",  qty: 4, reorderPoint: 5  },
];

async function main() {
  const brisbane = await prisma.location.findFirst({
    where: { name: { contains: "Brisbane" } },
  });
  if (!brisbane) { process.stdout.write("ERROR: Brisbane location not found\n"); return; }

  // Step 1: Delete wrong SKUs and their logs
  process.stdout.write("=== Deleting wrong SKUs ===\n");
  for (const sku of WRONG_SKUS) {
    const product = await prisma.product.findUnique({ where: { sku } });
    if (!product) { process.stdout.write(`NOT FOUND (skip): ${sku}\n`); continue; }

    const delLogs = await prisma.inventoryLog.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { sku } });
    process.stdout.write(`🗑  Deleted ${sku} (+ ${delLogs.count} log entries)\n`);
  }

  // Step 2: Create correct SKUs
  process.stdout.write("\n=== Creating correct SKUs ===\n");
  let created = 0, skipped = 0;

  for (const item of CORRECT_SKUS) {
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

    process.stdout.write(`✅ ${item.sku} | ${item.name} | Pair | qty: ${item.qty} | reorder: ${item.reorderPoint}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
