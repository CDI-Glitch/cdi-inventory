/**
 * Add TT-DDS-300 drop-down sides SKUs (Raw Alloy / Sahara Black / Splash White).
 * No opening stock.
 *
 * Run: npx tsx scripts/import-tt-dds-300.ts
 */
import { Pool } from "pg";
import { randomBytes } from "crypto";

const pool = new Pool({
  host: "tokaido.proxy.rlwy.net",
  port: 43176,
  user: "postgres",
  password: process.env.DB_PASS || "SHufVETPyuJhEckjrUldCjPZPkxrkVvv",
  database: "railway",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const SKUS = [
  { sku: "TT-DDS-300", name: "T Profile Drop Down Sides 300mm Raw Alloy" },
  { sku: "TT-DDS-300-SHB", name: "T Profile Drop Down Sides 300mm Sahara Black" },
  { sku: "TT-DDS-300-W", name: "T Profile Drop Down Sides 300mm Splash White" },
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
      [id, item.sku, item.name, "DROP_SIDES", "Set", 10, true, now, now]
    );
    console.log(`CREATED: ${item.sku} | ${item.name}`);
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
