import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  // Rear — 1800/2100 tray
  { sku: "TT-BSG-89-SHB",   name: "Pair T-Tray Rear Tie-Down Bar 1800/2100 Sahara Black", qty: 5, reorderPoint: 10 },
  { sku: "TT-BSG-89-W",     name: "Pair T-Tray Rear Tie-Down Bar 1800/2100 Splash White",  qty: 0, reorderPoint: 10 },
  { sku: "TT-BSG-89",       name: "Pair T-Tray Rear Tie-Down Bar 1800/2100 Raw Alloy",      qty: 0, reorderPoint: 10 },
  // Rear — 1600/2400 tray
  { sku: "TT-BSG-67-SHB",   name: "Pair T-Tray Rear Tie-Down Bar 1600/2400 Sahara Black", qty: 0, reorderPoint: 10 },
  { sku: "TT-BSG-67-W",     name: "Pair T-Tray Rear Tie-Down Bar 1600/2400 Splash White",  qty: 0, reorderPoint: 10 },
  { sku: "TT-BSG-67",       name: "Pair T-Tray Rear Tie-Down Bar 1600/2400 Raw Alloy",      qty: 0, reorderPoint: 10 },
  // Front — 2400 tray LHS
  { sku: "TT-QBSG-55L-SHB", name: "Pair T-Tray Front Tie-Down Bar 2400 LHS Sahara Black", qty: 0, reorderPoint: 10 },
  { sku: "TT-QBSG-55L-W",   name: "Pair T-Tray Front Tie-Down Bar 2400 LHS Splash White",  qty: 0, reorderPoint: 10 },
  { sku: "TT-QBSG-55L",     name: "Pair T-Tray Front Tie-Down Bar 2400 LHS Raw Alloy",      qty: 0, reorderPoint: 10 },
  // Front — 2400 tray RHS
  { sku: "TT-QBSG-89R-SHB", name: "Pair T-Tray Front Tie-Down Bar 2400 RHS Sahara Black", qty: 0, reorderPoint: 10 },
  { sku: "TT-QBSG-89R-W",   name: "Pair T-Tray Front Tie-Down Bar 2400 RHS Splash White",  qty: 0, reorderPoint: 10 },
  { sku: "TT-QBSG-89R",     name: "Pair T-Tray Front Tie-Down Bar 2400 RHS Raw Alloy",      qty: 0, reorderPoint: 10 },
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
        category: "UNDERBODY_TOOLBOX",
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

    process.stdout.write(`✅ ${item.sku} | unit: Pair | qty: ${item.qty} | reorder: ${item.reorderPoint}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
