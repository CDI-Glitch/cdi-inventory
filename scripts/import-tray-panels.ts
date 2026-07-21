import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  // C Profile VTD Drawer Panel
  { sku: "VTD-DTLMB-1850-SHB", name: "C Profile VTD Drawer Panel Sahara Black",  qty: 6,  reorderPoint: 10 },
  { sku: "VTD-DTLMB-1850-W",   name: "C Profile VTD Drawer Panel Splash White",   qty: 4,  reorderPoint: 5  },
  // T Profile VTD Drawer Panel
  { sku: "TT-MB-SHB",          name: "T Profile VTD Drawer Panel Sahara Black",   qty: 10, reorderPoint: 10 },
  { sku: "TT-MB-W",            name: "T Profile VTD Drawer Panel Splash White",   qty: 0,  reorderPoint: 10 },
  { sku: "TT-MB",              name: "T Profile VTD Drawer Panel Raw Alloy",       qty: 0,  reorderPoint: 10 },
  // C Profile No-Drawer Panel
  { sku: "DTLMB-1850S",        name: "C Profile No-Drawer Panel Raw Alloy",       qty: 0,  reorderPoint: 10 },
  { sku: "DTLMB-1850SHB",      name: "C Profile No-Drawer Panel Sahara Black",    qty: 0,  reorderPoint: 10 },
  { sku: "DTLMB-1850W",        name: "C Profile No-Drawer Panel Splash White",    qty: 0,  reorderPoint: 10 },
  // T Profile No-Drawer Panel
  { sku: "TT-PZB-SHB",         name: "T Profile No-Drawer Panel Sahara Black",    qty: 0,  reorderPoint: 10 },
  { sku: "TT-PZB-W",           name: "T Profile No-Drawer Panel Splash White",    qty: 0,  reorderPoint: 10 },
  { sku: "TT-PZB",             name: "T Profile No-Drawer Panel Raw Alloy",        qty: 0,  reorderPoint: 10 },
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
        unit: "Each",
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

    process.stdout.write(`✅ ${item.sku} | ${item.name} | qty: ${item.qty} | reorder: ${item.reorderPoint}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
