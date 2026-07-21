import * as XLSX from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const FILE_PATH =
  "c:/Users/CoreD/Documents/Codex/2026-07-20/x-z/outputs/canopy_c_channel_sku_import/Canopy_Top_C_Channel_SKU_Import.xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const wb = XLSX.readFile(FILE_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

  // Data starts at row index 4 (after header rows)
  const dataRows = rows.slice(4).filter((r) => r[0] && String(r[0]).trim());

  process.stdout.write(`Found ${dataRows.length} SKUs to import\n\n`);

  let created = 0;
  let skipped = 0;

  for (const row of dataRows) {
    const sku = String(row[0]).trim();
    const name = String(row[1]).trim();
    const category = String(row[2]).trim().toUpperCase();
    const unit = String(row[3]).trim();
    const active = String(row[6]).trim().toLowerCase() === "yes";

    // Check if already exists
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) {
      process.stdout.write(`SKIP (exists): ${sku}\n`);
      skipped++;
      continue;
    }

    await prisma.product.create({
      data: {
        sku,
        name,
        category,
        unit,
        active,
      },
    });

    process.stdout.write(`✅ Created: ${sku} — ${name}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
