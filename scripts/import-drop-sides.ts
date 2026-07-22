import { Pool } from "pg";
import { randomBytes } from "crypto";

const pool = new Pool({
  host: "tokaido.proxy.rlwy.net",
  port: 43176,
  user: "postgres",
  password: "SHufVETPyuJhEckjrUldCjPZPkxrkVvv",
  database: "railway",
  ssl: { rejectUnauthorized: false },
});

function cuid() {
  return "c" + randomBytes(11).toString("hex");
}

const SKUS = [
  { sku: "TT-DDS-400-SHB",  name: "T Profile Drop Down Sides 400mm Sahara Black",  reorderPoint: 10 },
  { sku: "TT-DDS-400-W",    name: "T Profile Drop Down Sides 400mm Splash White",   reorderPoint: 10 },
  { sku: "TT-DDS-400",      name: "T Profile Drop Down Sides 400mm Raw Alloy",      reorderPoint: 10 },
  { sku: "TT-DDS-600-SHB",  name: "T Profile Drop Down Sides 600mm Sahara Black",  reorderPoint: 10 },
  { sku: "TT-DDS-600-W",    name: "T Profile Drop Down Sides 600mm Splash White",   reorderPoint: 10 },
  { sku: "TT-DDS-600",      name: "T Profile Drop Down Sides 600mm Raw Alloy",      reorderPoint: 10 },
  { sku: "TT-DDS-1800-SHB", name: "T Profile Drop Down Sides 1800mm Sahara Black", reorderPoint: 10 },
  { sku: "TT-DDS-1800-W",   name: "T Profile Drop Down Sides 1800mm Splash White",  reorderPoint: 10 },
  { sku: "TT-DDS-1800",     name: "T Profile Drop Down Sides 1800mm Raw Alloy",     reorderPoint: 10 },
];

async function main() {
  let created = 0, skipped = 0;

  for (const item of SKUS) {
    const check = await pool.query('SELECT id FROM "Product" WHERE sku = $1', [item.sku]);
    if (check.rows.length > 0) {
      process.stdout.write(`SKIP (exists): ${item.sku}\n`);
      skipped++;
      continue;
    }

    const id = cuid();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, item.sku, item.name, "DROP_SIDES", "Set", item.reorderPoint, true, now, now]
    );

    process.stdout.write(`✅ ${item.sku} | ${item.name}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => pool.end());
