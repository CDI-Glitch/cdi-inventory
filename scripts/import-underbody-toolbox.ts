import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  { sku: "BX01-1819-L-SHB", name: "C-Profile Underbody Toolbox 1819 LHS Sahara Black",  qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1819-L-W",   name: "C-Profile Underbody Toolbox 1819 LHS Splash White",   qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1819-R-SHB", name: "C-Profile Underbody Toolbox 1819 RHS Sahara Black",  qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1819-R-W",   name: "C-Profile Underbody Toolbox 1819 RHS Splash White",   qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1815-L-SHB", name: "C-Profile Underbody Toolbox 1815 LHS Sahara Black",  qty: 6,  reorderPoint: 15 },
  { sku: "BX01-1815-L-W",   name: "C-Profile Underbody Toolbox 1815 LHS Splash White",   qty: 4,  reorderPoint: 15 },
  { sku: "BX01-1815-R-SHB", name: "C-Profile Underbody Toolbox 1815 RHS Sahara Black",  qty: 6,  reorderPoint: 15 },
  { sku: "BX01-1815-R-W",   name: "C-Profile Underbody Toolbox 1815 RHS Splash White",   qty: 4,  reorderPoint: 15 },
  { sku: "BX01-1811-L-SHB", name: "C-Profile Underbody Toolbox 1811 LHS Sahara Black",  qty: 5,  reorderPoint: 5  },
  { sku: "BX01-1811-L-W",   name: "C-Profile Underbody Toolbox 1811 LHS Splash White",   qty: 0,  reorderPoint: 5  },
  { sku: "BX01-1811-R-SHB", name: "C-Profile Underbody Toolbox 1811 RHS Sahara Black",  qty: 5,  reorderPoint: 5  },
  { sku: "BX01-1811-R-W",   name: "C-Profile Underbody Toolbox 1811 RHS Splash White",   qty: 0,  reorderPoint: 5  },
  { sku: "BX01-1619-L-SHB", name: "C-Profile Underbody Toolbox 1619 LHS Sahara Black",  qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1619-L-W",   name: "C-Profile Underbody Toolbox 1619 LHS Splash White",   qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1619-R-SHB", name: "C-Profile Underbody Toolbox 1619 RHS Sahara Black",  qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1619-R-W",   name: "C-Profile Underbody Toolbox 1619 RHS Splash White",   qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1615-L-SHB", name: "C-Profile Underbody Toolbox 1615 LHS Sahara Black",  qty: 8,  reorderPoint: 15 },
  { sku: "BX01-1615-L-W",   name: "C-Profile Underbody Toolbox 1615 LHS Splash White",   qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1615-R-SHB", name: "C-Profile Underbody Toolbox 1615 RHS Sahara Black",  qty: 8,  reorderPoint: 15 },
  { sku: "BX01-1615-R-W",   name: "C-Profile Underbody Toolbox 1615 RHS Splash White",   qty: 0,  reorderPoint: 15 },
  { sku: "BX01-1611-L-SHB", name: "C-Profile Underbody Toolbox 1611 LHS Sahara Black",  qty: 7,  reorderPoint: 5  },
  { sku: "BX01-1611-L-W",   name: "C-Profile Underbody Toolbox 1611 LHS Splash White",   qty: 0,  reorderPoint: 5  },
  { sku: "BX01-1611-R-SHB", name: "C-Profile Underbody Toolbox 1611 RHS Sahara Black",  qty: 7,  reorderPoint: 5  },
  { sku: "BX01-1611-R-W",   name: "C-Profile Underbody Toolbox 1611 RHS Splash White",   qty: 0,  reorderPoint: 5  },
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

    process.stdout.write(`✅ ${item.sku} | ${item.name} | qty: ${item.qty} | reorder: ${item.reorderPoint}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
