import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const product = await prisma.product.findUnique({ where: { sku: "TRAY-1805SHB" } });
  if (!product) { process.stdout.write("SKU not found\n"); return; }

  const logs = await prisma.inventoryLog.deleteMany({ where: { productId: product.id } });
  process.stdout.write(`Deleted ${logs.count} InventoryLog records\n`);

  const incomingLines = await prisma.incomingLine.deleteMany({ where: { productId: product.id } });
  process.stdout.write(`Deleted ${incomingLines.count} IncomingLine records\n`);

  const bundleItems = await prisma.bundleItem.deleteMany({ where: { productId: product.id } });
  process.stdout.write(`Deleted ${bundleItems.count} BundleItem records\n`);

  const movements = await prisma.generatedMovement.deleteMany({ where: { productId: product.id } });
  process.stdout.write(`Deleted ${movements.count} GeneratedMovement records\n`);

  await prisma.product.delete({ where: { sku: "TRAY-1805SHB" } });
  process.stdout.write(`✅ Deleted SKU: ${product.sku} — ${product.name}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
