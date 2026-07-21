import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  // Rear toolbox — 1800/2100 tray
  { sku: "TT-BX-90-L-SHB", name: "T-Profile Rear Underbody Toolbox 1800/2100 LHS Sahara Black", qty: 6, reorderPoint: 10 },
  { sku: "TT-BX-90-L-W",   name: "T-Profile Rear Underbody Toolbox 1800/2100 LHS Splash White",  qty: 0, reorderPoint: 10 },
  { sku: "TT-BX-90-L",     name: "T-Profile Rear Underbody Toolbox 1800/2100 LHS Raw Alloy",      qty: 0, reorderPoint: 10 },
  { sku: "TT-BX-90-R-SHB", name: "T-Profile Rear Underbody Toolbox 1800/2100 RHS Sahara Black", qty: 6, reorderPoint: 10 },
  { sku: "TT-BX-90-R-W",   name: "T-Profile Rear Underbody Toolbox 1800/2100 RHS Splash White",  qty: 0, reorderPoint: 10 },
  { sku: "TT-BX-90-R",     name: "T-Profile Rear Underbody Toolbox 1800/2100 RHS Raw Alloy",      qty: 0, reorderPoint: 10 },
  // Rear toolbox — 1600/2400 tray
  { sku: "TT-BX-68-L-SHB", name: "T-Profile Rear Underbody Toolbox 1600/2400 LHS Sahara Black", qty: 0, reorderPoint: 10 },
  { sku: "TT-BX-68-L-W",   name: "T-Profile Rear Underbody Toolbox 1600/2400 LHS Splash White",  qty: 0, reorderPoint: 10 },
  { sku: "TT-BX-68-L",     name: "T-Profile Rear Underbody Toolbox 1600/2400 LHS Raw Alloy",      qty: 0, reorderPoint: 10 },
  { sku: "TT-BX-68-R-SHB", name: "T-Profile Rear Underbody Toolbox 1600/2400 RHS Sahara Black", qty: 0, reorderPoint: 10 },
  { sku: "TT-BX-68-R-W",   name: "T-Profile Rear Underbody Toolbox 1600/2400 RHS Splash White",  qty: 0, reorderPoint: 10 },
  { sku: "TT-BX-68-R",     name: "T-Profile Rear Underbody Toolbox 1600/2400 RHS Raw Alloy",      qty: 0, reorderPoint: 10 },
  // Front toolbox — 2400 tray LHS
  { sku: "TT-QBX-55-L-SHB", name: "T-Profile Front Underbody Toolbox 2400 LHS Sahara Black",    qty: 0, reorderPoint: 10 },
  { sku: "TT-QBX-55-L-W",   name: "T-Profile Front Underbody Toolbox 2400 LHS Splash White",     qty: 0, reorderPoint: 10 },
  { sku: "TT-QBX-55-L",     name: "T-Profile Front Underbody Toolbox 2400 LHS Raw Alloy",         qty: 0, reorderPoint: 10 },
  // Front toolbox — 2400 tray RHS
  { sku: "TT-QBX-73-R-SHB", name: "T-Profile Front Underbody Toolbox 2400 RHS Sahara Black",    qty: 0, reorderPoint: 10 },
  { sku: "TT-QBX-73-R-W",   name: "T-Profile Front Underbody Toolbox 2400 RHS Splash White",     qty: 0, reorderPoint: 10 },
  { sku: "TT-QBX-73-R",     name: "T-Profile Front Underbody Toolbox 2400 RHS Raw Alloy",         qty: 0, reorderPoint: 10 },
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

    process.stdout.write(`✅ ${item.sku} | qty: ${item.qty} | reorder: ${item.reorderPoint}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
