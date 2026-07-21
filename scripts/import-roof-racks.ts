import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  // Standard Roof Rack Bar
  { sku: "CD-RR-SHB",      name: "Roof Rack Bar Channel Sahara Black",       qty: 20, reorderPoint: 20 },
  { sku: "CD-RR-W",        name: "Roof Rack Bar Channel Splash White",        qty: 10, reorderPoint: 10 },
  { sku: "CD-RR",          name: "Roof Rack Bar Channel Raw Alloy",           qty: 0,  reorderPoint: 20 },
  // CMS Roof Rack Bar
  { sku: "CMS-RR-SHB",     name: "CMS Roof Rack Bar Channel Sahara Black",   qty: 0,  reorderPoint: 20 },
  { sku: "CMS-RR-W",       name: "CMS Roof Rack Bar Channel Splash White",    qty: 0,  reorderPoint: 20 },
  { sku: "CMS-RR",         name: "CMS Roof Rack Bar Channel Raw Alloy",       qty: 0,  reorderPoint: 20 },
  // Full Roof Rack 1800
  { sku: "CD-FRR1800-SHB", name: "Full Roof Rack Channel 1800 Sahara Black", qty: 10, reorderPoint: 10 },
  { sku: "CD-FRR1800-W",   name: "Full Roof Rack Channel 1800 Splash White",  qty: 2,  reorderPoint: 5  },
  { sku: "CD-FRR1800",     name: "Full Roof Rack Channel 1800 Raw Alloy",     qty: 0,  reorderPoint: 5  },
  // Full Roof Rack 1600
  { sku: "CD-FRR1600-SHB", name: "Full Roof Rack Channel 1600 Sahara Black", qty: 0,  reorderPoint: 10 },
  { sku: "CD-FRR1600-W",   name: "Full Roof Rack Channel 1600 Splash White",  qty: 0,  reorderPoint: 5  },
  { sku: "CD-FRR1600",     name: "Full Roof Rack Channel 1600 Raw Alloy",     qty: 0,  reorderPoint: 5  },
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
        category: "ROOF_RACK",
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
