import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  // 1605
  { sku: "T-Tray-1605-SHB", name: "T Tray Deck 1775 x 1605 Sahara Black",          qty: 0,  reorderPoint: 10 },
  { sku: "T-Tray-1605-W",   name: "T Tray Deck 1775 x 1605 Splash White",           qty: 0,  reorderPoint: 10 },
  { sku: "T-Tray-1605",     name: "T Tray Deck 1775 x 1605 Raw Alloy",              qty: 0,  reorderPoint: 10 },
  // 1805
  { sku: "T-Tray-1805-SHB", name: "T Tray Deck 1775 x 1805 Sahara Black",          qty: 5,  reorderPoint: 10 },
  { sku: "T-Tray-1805-W",   name: "T Tray Deck 1775 x 1805 Splash White",           qty: 0,  reorderPoint: 10 },
  { sku: "T-Tray-1805",     name: "T Tray Deck 1775 x 1805 Raw Alloy",              qty: 0,  reorderPoint: 10 },
  // 2105
  { sku: "T-Tray-2105-SHB", name: "T Tray Deck 1775 x 2105 Sahara Black",          qty: 0,  reorderPoint: 10 },
  { sku: "T-Tray-2105-W",   name: "T Tray Deck 1775 x 2105 Splash White",           qty: 0,  reorderPoint: 10 },
  { sku: "T-Tray-2105",     name: "T Tray Deck 1775 x 2105 Raw Alloy",              qty: 0,  reorderPoint: 10 },
  // 2405
  { sku: "T-Tray-2405-SHB", name: "T Tray Deck 1775 x 2405 Sahara Black",          qty: 0,  reorderPoint: 10 },
  { sku: "T-Tray-2405-W",   name: "T Tray Deck 1775 x 2405 Splash White",           qty: 0,  reorderPoint: 10 },
  { sku: "T-Tray-2405",     name: "T Tray Deck 1775 x 2405 Raw Alloy",              qty: 0,  reorderPoint: 10 },
  // Legacy
  { sku: "Ttay-1805-SHB",   name: "T Tray Deck 1775 x 1805 Sahara Black (Legacy)", qty: 15, reorderPoint: 10 },
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
        category: "TRAY_DECK",
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

    const tag = item.sku === "Ttay-1805-SHB" ? " [legacy]" : "";
    process.stdout.write(`✅ ${item.sku}${tag} | qty: ${item.qty} | reorder: ${item.reorderPoint}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
