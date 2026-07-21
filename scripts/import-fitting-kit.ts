import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  { sku: "FK",    name: "Fitting Kit",           qty: 192, reorderPoint: 100 },
  { sku: "FK-Ex", name: "Fitting Kit Extension", qty: 1,   reorderPoint: 100 },
];

async function main() {
  const brisbane = await prisma.location.findFirst({
    where: { name: { contains: "Brisbane" } },
  });
  if (!brisbane) { process.stdout.write("ERROR: Brisbane location not found\n"); return; }
  process.stdout.write(`Location: ${brisbane.name}\n\n`);

  for (const item of SKUS) {
    const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (existing) { process.stdout.write(`SKIP (exists): ${item.sku}\n`); continue; }

    const product = await prisma.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        category: "FITTING_KIT",
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

    process.stdout.write(`✅ ${item.sku} — ${item.name} | reorderPoint: ${item.reorderPoint} | opening stock: ${item.qty}\n`);
  }
  process.stdout.write("\nDone.\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
