import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  // 2 Door
  { sku: "CMS-2D-18169-SHB", name: "2 Door Service Body 1850 x 1600 Sahara Black Lite", qty: 0, reorderPoint: 3 },
  { sku: "CMS-2D-18169-W",   name: "2 Door Service Body 1850 x 1600 Splash White Lite",  qty: 0, reorderPoint: 3 },
  { sku: "CMS-2D-18189-SHB", name: "2 Door Service Body 1850 x 1800 Sahara Black Lite", qty: 6, reorderPoint: 3 },
  { sku: "CMS-2D-18189-W",   name: "2 Door Service Body 1850 x 1800 Splash White Lite",  qty: 4, reorderPoint: 2 },
  { sku: "CMS-2D-18219-SHB", name: "2 Door Service Body 1850 x 2100 Sahara Black Lite", qty: 0, reorderPoint: 3 },
  { sku: "CMS-2D-18219-W",   name: "2 Door Service Body 1850 x 2100 Splash White Lite",  qty: 0, reorderPoint: 3 },
  { sku: "CMS-2D-18249-SHB", name: "2 Door Service Body 1850 x 2400 Sahara Black Lite", qty: 0, reorderPoint: 3 },
  { sku: "CMS-2D-18249-W",   name: "2 Door Service Body 1850 x 2400 Splash White Lite",  qty: 0, reorderPoint: 3 },
  // 3 Door
  { sku: "CMS-3D-18169-SHB", name: "3 Door Service Body 1850 x 1600 Sahara Black Lite", qty: 0, reorderPoint: 3 },
  { sku: "CMS-3D-18169-W",   name: "3 Door Service Body 1850 x 1600 Splash White Lite",  qty: 0, reorderPoint: 3 },
  { sku: "CMS-3D-18189-SHB", name: "3 Door Service Body 1850 x 1800 Sahara Black Lite", qty: 0, reorderPoint: 3 },
  { sku: "CMS-3D-18189-W",   name: "3 Door Service Body 1850 x 1800 Splash White Lite",  qty: 0, reorderPoint: 3 },
  { sku: "CMS-3D-18219-SHB", name: "3 Door Service Body 1850 x 2100 Sahara Black Lite", qty: 0, reorderPoint: 3 },
  { sku: "CMS-3D-18219-W",   name: "3 Door Service Body 1850 x 2100 Splash White Lite",  qty: 0, reorderPoint: 3 },
  { sku: "CMS-3D-18249-SHB", name: "3 Door Service Body 1850 x 2400 Sahara Black Lite", qty: 0, reorderPoint: 3 },
  { sku: "CMS-3D-18249-W",   name: "3 Door Service Body 1850 x 2400 Splash White Lite",  qty: 0, reorderPoint: 3 },
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
        category: "SERVICE_BODY",
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
