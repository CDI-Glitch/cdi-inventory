/**
 * Add Tie-Down Ring + matching channel nut (GENERAL_ACCESSORY)
 * and 304 non-standard washer (CONSUMABLE CSM0045). No opening stock. No kit/bundle.
 *
 * Run: npx tsx scripts/import-tdr-and-csm0045.ts
 */
import "dotenv/config";
import { Pool } from "pg";
import { randomBytes } from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const SKUS = [
  {
    sku: "TDR",
    name: "Tie-Down Ring 绑绳环 (M8*15)",
    category: "GENERAL_ACCESSORY",
    unit: "Each",
    reorderPoint: 10,
  },
  {
    sku: "TDR-CN",
    name: "Tray Tie-Down Ring Channel Nut",
    category: "GENERAL_ACCESSORY",
    unit: "Each",
    reorderPoint: 10,
  },
  {
    sku: "CSM0045",
    name: "304非标平垫 M8*20*2.0",
    category: "CONSUMABLE",
    unit: "Each",
    reorderPoint: 50,
  },
];

function cuid() {
  return "c" + randomBytes(11).toString("hex");
}

async function main() {
  let created = 0;
  let skipped = 0;

  for (const item of SKUS) {
    const existing = await pool.query('SELECT id FROM "Product" WHERE sku = $1', [item.sku]);
    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`SKIP (exists): ${item.sku}`);
      skipped++;
      continue;
    }

    const id = cuid();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, item.sku, item.name, item.category, item.unit, item.reorderPoint, true, now, now]
    );
    console.log(`CREATED: ${item.sku} | ${item.name} | ${item.category}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
