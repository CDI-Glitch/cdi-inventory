import * as XLSX from "xlsx";

const filePath = "C:/Users/CoreD/Documents/Codex/2026-07-20/x-z/outputs/base_canopy_sku_import/Base_Canopy_SKU_Import_17188_JKC_ONLY.xlsx";

const wb = XLSX.readFile(filePath);
const ws = wb.Sheets["SKU Import"];
const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

const headers = rows[3];
const data = rows.slice(4).filter((r) => r[0] !== "");

process.stdout.write("Headers: " + JSON.stringify(headers) + "\n");
process.stdout.write("Total data rows: " + data.length + "\n\n");
for (const r of data) {
  process.stdout.write(JSON.stringify(r) + "\n");
}
