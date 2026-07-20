import * as XLSX from 'xlsx';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DB_URL =
  'postgresql://postgres:SHufVETPyuJhEckjrUldCjPZPkxrkVvv@tokaido.proxy.rlwy.net:43176/railway';

const CATEGORY_MAP: Record<string, string> = {
  Canopy: 'CANOPY',
  Tray: 'TRAY',
  Accessory: 'ACCESSORY',
  Base: 'BASE_CANOPY',
};

async function main() {
  const adapter = new PrismaPg({ connectionString: DB_URL });
  const prisma = new PrismaClient({ adapter } as any);

  const wb = XLSX.readFile(
    'c:/Users/CoreD/Documents/Codex/2026-07-20/x-z/outputs/lc79_tray_sku_import/LC79_Factory_Tray_SKU_Import.xlsx'
  );
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  const dataRows = rows.slice(4).filter((r) => r[0] && String(r[0]).trim());

  console.log(`Found ${dataRows.length} SKUs to import`);
  let created = 0;
  let skipped = 0;

  for (const r of dataRows) {
    const sku = String(r[0]).trim();
    const name = String(r[1]).trim();
    const categoryRaw = String(r[2]).trim();
    const reorderPoint = Number(r[5]) || 1;
    const active = String(r[6]).trim().toLowerCase() !== 'no';
    const category = CATEGORY_MAP[categoryRaw] ?? 'CANOPY';

    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) {
      console.log(`SKIP (exists): ${sku}`);
      skipped++;
      continue;
    }

    await prisma.product.create({
      data: { sku, name, category, unit: 'Each', reorderPoint, active },
    });
    console.log(`CREATED: ${sku}`);
    created++;
  }

  await (prisma as any).$disconnect();
  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
