import * as XLSX from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const filePath = "C:/Users/CoreD/Documents/Codex/2026-07-20/x-z/outputs/base_canopy_sku_import/Base_Canopy_SKU_Import_17188_JKC_ONLY.xlsx";

async function main() {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["SKU Import"];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Header is row index 3, data starts at row index 4
  const data = rows.slice(4).filter((r) => r[0] !== "");

  let created = 0;
  let skipped = 0;

  for (const row of data) {
    const [sku, name, category, unit, , reorderPoint, activeStr] = row;
    const active = String(activeStr).toLowerCase() === "yes";

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
        category: String(category).toLowerCase().replace(/ /g, "_"),
        unit: unit || "Each",
        reorderPoint: Number(reorderPoint) || 2,
        active,
      },
    });
    process.stdout.write(`CREATED: ${sku} — ${name}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
