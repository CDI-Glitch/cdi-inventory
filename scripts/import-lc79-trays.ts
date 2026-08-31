import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

// LC79 Factory Tray Canopy — 35 variants
// 2-door only; 1840mm wide x 1000mm high; lengths 1000/1200/1400/1600/1800
// Colours: Raw Alloy (no suffix) / SHB / ST / G / W / BST / FV
const SKUS = [
  { sku: 'LC-2D-181010', name: 'LC79 Jack Off Factory Tray Canopy 1000 Raw Alloy' },
  { sku: 'LC-2D-181010-SHB', name: 'LC79 Jack Off Factory Tray Canopy 1000 Sahara Black' },
  { sku: 'LC-2D-181010-ST',  name: 'LC79 Jack Off Factory Tray Canopy 1000 Sandy Taupe' },
  { sku: 'LC-2D-181010-G',   name: 'LC79 Jack Off Factory Tray Canopy 1000 Graphite' },
  { sku: 'LC-2D-181010-BST', name: 'LC79 Jack Off Factory Tray Canopy 1000 Sahara Black Body / Sandy Taupe Doors' },
  { sku: 'LC-2D-181010-W',   name: 'LC79 Jack Off Factory Tray Canopy 1000 Splash White' },
  { sku: 'LC-2D-181010-FV',  name: 'LC79 Jack Off Factory Tray Canopy 1000 French Vanilla' },
  { sku: 'LC-2D-181210', name: 'LC79 Jack Off Factory Tray Canopy 1200 Raw Alloy' },
  { sku: 'LC-2D-181210-SHB', name: 'LC79 Factory Tray Canopy 1200 C Channel Sahara Black' },
  { sku: 'LC-2D-181210-ST',  name: 'LC79 Factory Tray Canopy 1200 C Channel Sandy Taupe' },
  { sku: 'LC-2D-181210-G',   name: 'LC79 Factory Tray Canopy 1200 C Channel Graphite' },
  { sku: 'LC-2D-181210-BST', name: 'LC79 Factory Tray Canopy 1200 C Channel Sahara Black Body / Sandy Taupe Doors' },
  { sku: 'LC-2D-181210-W',   name: 'LC79 Factory Tray Canopy 1200 C Channel Splash White' },
  { sku: 'LC-2D-181210-FV',  name: 'LC79 Jack Off Factory Tray Canopy 1200 French Vanilla' },
  { sku: 'LC-2D-181410', name: 'LC79 Jack Off Factory Tray Canopy 1400 Raw Alloy' },
  { sku: 'LC-2D-181410-SHB', name: 'LC79 Factory Tray Canopy 1400 C Channel Sahara Black' },
  { sku: 'LC-2D-181410-ST',  name: 'LC79 Factory Tray Canopy 1400 C Channel Sandy Taupe' },
  { sku: 'LC-2D-181410-G',   name: 'LC79 Factory Tray Canopy 1400 C Channel Graphite' },
  { sku: 'LC-2D-181410-BST', name: 'LC79 Factory Tray Canopy 1400 C Channel Sahara Black Body / Sandy Taupe Doors' },
  { sku: 'LC-2D-181410-W',   name: 'LC79 Factory Tray Canopy 1400 C Channel Splash White' },
  { sku: 'LC-2D-181410-FV',  name: 'LC79 Jack Off Factory Tray Canopy 1400 French Vanilla' },
  { sku: 'LC-2D-181610', name: 'LC79 Jack Off Factory Tray Canopy 1600 Raw Alloy' },
  { sku: 'LC-2D-181610-SHB', name: 'LC79 Factory Tray Canopy 1600 C Channel Sahara Black' },
  { sku: 'LC-2D-181610-ST',  name: 'LC79 Factory Tray Canopy 1600 C Channel Sandy Taupe' },
  { sku: 'LC-2D-181610-G',   name: 'LC79 Factory Tray Canopy 1600 C Channel Graphite' },
  { sku: 'LC-2D-181610-BST', name: 'LC79 Factory Tray Canopy 1600 C Channel Sahara Black Body / Sandy Taupe Doors' },
  { sku: 'LC-2D-181610-W',   name: 'LC79 Factory Tray Canopy 1600 C Channel Splash White' },
  { sku: 'LC-2D-181610-FV',  name: 'LC79 Jack Off Factory Tray Canopy 1600 French Vanilla' },
  { sku: 'LC-2D-181810', name: 'LC79 Jack Off Factory Tray Canopy 1800 Raw Alloy' },
  { sku: 'LC-2D-181810-SHB', name: 'LC79 Factory Tray Canopy 1800 C Channel Sahara Black' },
  { sku: 'LC-2D-181810-ST',  name: 'LC79 Factory Tray Canopy 1800 C Channel Sandy Taupe' },
  { sku: 'LC-2D-181810-G',   name: 'LC79 Factory Tray Canopy 1800 C Channel Graphite' },
  { sku: 'LC-2D-181810-BST', name: 'LC79 Factory Tray Canopy 1800 C Channel Sahara Black Body / Sandy Taupe Doors' },
  { sku: 'LC-2D-181810-W',   name: 'LC79 Factory Tray Canopy 1800 C Channel Splash White' },
  { sku: 'LC-2D-181810-FV',  name: 'LC79 Jack Off Factory Tray Canopy 1800 French Vanilla' },
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
