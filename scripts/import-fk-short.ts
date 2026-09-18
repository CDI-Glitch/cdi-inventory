/**
 * Add FK-SHORT as a FITTING_KIT SKU. No opening stock. Not added to any BOM.
 *
 * Run: npx tsx scripts/import-fk-short.ts
 */
import "dotenv/config";
import { Pool } from "pg";
import { randomBytes } from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

function cuid() {
  return "c" + randomBytes(11).toString("hex");
}

async function main() {
  const sku = "FK-SHORT";
  const name = "Fitting Kit Short";
  const existing = await pool.query('SELECT id FROM "Product" WHERE sku = $1', [sku]);
  if (existing.rowCount && existing.rowCount > 0) {
    console.log(`SKIP (exists): ${sku}`);
    return;
  }

  const id = cuid();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, sku, name, "FITTING_KIT", "Each", 100, true, now, now]
  );
  console.log(`CREATED: ${sku} | ${name} | FITTING_KIT`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
