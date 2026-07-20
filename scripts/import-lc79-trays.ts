import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// LC79 Factory Tray Canopy — 20 variants
// 2-door only; 1840mm wide x 1000mm high; lengths 1200/1400/1600/1800
// Raw Alloy not included
const SKUS = [
  { sku: 'LC-2D-181210-SHB', name: 'LC79 Factory Tray Canopy 1200 C Channel Sahara Black' },
  { sku: 'LC-2D-181210-ST',  name: 'LC79 Factory Tray Canopy 1200 C Channel Sandy Taupe' },
  { sku: 'LC-2D-181210-G',   name: 'LC79 Factory Tray Canopy 1200 C Channel Graphite' },
  { sku: 'LC-2D-181210-BST', name: 'LC79 Factory Tray Canopy 1200 C Channel Sahara Black Body / Sandy Taupe Doors' },
  { sku: 'LC-2D-181210-W',   name: 'LC79 Factory Tray Canopy 1200 C Channel Splash White' },
  { sku: 'LC-2D-181410-SHB', name: 'LC79 Factory Tray Canopy 1400 C Channel Sahara Black' },
  { sku: 'LC-2D-181410-ST',  name: 'LC79 Factory Tray Canopy 1400 C Channel Sandy Taupe' },
  { sku: 'LC-2D-181410-G',   name: 'LC79 Factory Tray Canopy 1400 C Channel Graphite' },
  { sku: 'LC-2D-181410-BST', name: 'LC79 Factory Tray Canopy 1400 C Channel Sahara Black Body / Sandy Taupe Doors' },
  { sku: 'LC-2D-181410-W',   name: 'LC79 Factory Tray Canopy 1400 C Channel Splash White' },
  { sku: 'LC-2D-181610-SHB', name: 'LC79 Factory Tray Canopy 1600 C Channel Sahara Black' },
  { sku: 'LC-2D-181610-ST',  name: 'LC79 Factory Tray Canopy 1600 C Channel Sandy Taupe' },
  { sku: 'LC-2D-181610-G',   name: 'LC79 Factory Tray Canopy 1600 C Channel Graphite' },
  { sku: 'LC-2D-181610-BST', name: 'LC79 Factory Tray Canopy 1600 C Channel Sahara Black Body / Sandy Taupe Doors' },
  { sku: 'LC-2D-181610-W',   name: 'LC79 Factory Tray Canopy 1600 C Channel Splash White' },
  { sku: 'LC-2D-181810-SHB', name: 'LC79 Factory Tray Canopy 1800 C Channel Sahara Black' },
  { sku: 'LC-2D-181810-ST',  name: 'LC79 Factory Tray Canopy 1800 C Channel Sandy Taupe' },
  { sku: 'LC-2D-181810-G',   name: 'LC79 Factory Tray Canopy 1800 C Channel Graphite' },
  { sku: 'LC-2D-181810-BST', name: 'LC79 Factory Tray Canopy 1800 C Channel Sahara Black Body / Sandy Taupe Doors' },
  { sku: 'LC-2D-181810-W',   name: 'LC79 Factory Tray Canopy 1800 C Channel Splash White' },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as any);

  console.log(`Importing ${SKUS.length} LC79 Factory Tray Canopy SKUs...`);
  let created = 0;
  let skipped = 0;

  for (const item of SKUS) {
    const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (existing) {
      console.log(`SKIP (exists): ${item.sku}`);
      skipped++;
      continue;
    }
    await prisma.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        category: 'CANOPY',
        unit: 'Each',
        reorderPoint: 1,
        active: true,
      },
    });
    console.log(`CREATED: ${item.sku}`);
    created++;
  }

  await (prisma as any).$disconnect();
  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
