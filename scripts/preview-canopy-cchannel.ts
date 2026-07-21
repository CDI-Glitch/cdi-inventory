import * as XLSX from "xlsx";

const FILE_PATH = "c:/Users/CoreD/Documents/Codex/2026-07-20/x-z/outputs/canopy_c_channel_sku_import/Canopy_Top_C_Channel_SKU_Import.xlsx";

const wb = XLSX.readFile(FILE_PATH);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];

const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

process.stdout.write(`Sheet: ${sheetName}\nTotal rows: ${rows.length}\n\n`);

// Print first 20 rows
rows.slice(0, 20).forEach((row, i) => {
  process.stdout.write(`Row ${i}: ${JSON.stringify(row)}\n`);
});
