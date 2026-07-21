import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  // Standard
  { sku: "CD-MG-SHB",    name: "Mud Guards Sahara Black",        qty: 6,  reorderPoint: 10 },
  { sku: "CD-MG-W",      name: "Mud Guards Splash White",        qty: 4,  reorderPoint: 5  },
  { sku: "CD-MG",        name: "Mud Guards Raw Alloy",            qty: 0,  reorderPoint: 10 },
  // DT
  { sku: "CD-MG-DT-SHB", name: "Mud Guards DT Sahara Black",    qty: 13, reorderPoint: 10 },
  { sku: "CD-MG-DT-W",   name: "Mud Guards DT Splash White",    qty: 3,  reorderPoint: 5  },
  { sku: "CD-MG-DT",     name: "Mud Guards DT Raw Alloy",        qty: 0,  reorderPoint: 10 },
  // HR
  { sku: "CD-MG-HR-SHB", name: "Mud Guards HR Sahara Black",    qty: 13, reorderPoint: 10 },
  { sku: "CD-MG-HR-W",   name: "Mud Guards HR Splash White",    qty: 3,  reorderPoint: 5  },
  { sku: "CD-MG-HR",     name: "Mud Guards HR Raw Alloy",        qty: 0,  reorderPoint: 10 },
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
        category: "MUDGUARD",
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
