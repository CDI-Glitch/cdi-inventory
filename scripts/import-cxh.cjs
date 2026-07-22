const { Pool } = require("pg");
const { randomBytes } = require("crypto");

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

async function main() {
  // Find Brisbane location
  const locRes = await pool.query(
    `SELECT id, name FROM "Location" WHERE name ILIKE '%Brisbane%' LIMIT 1`
  );
  if (!locRes.rows.length) { process.stdout.write("ERROR: Brisbane not found\n"); return; }
  const brisbane = locRes.rows[0];
  process.stdout.write(`Location: ${brisbane.name}\n`);

  const sku = "CXH";
  const name = "Under Tray Harness Cover";
  const qty = 32;
  const reorderPoint = 50;

  const check = await pool.query(`SELECT id FROM "Product" WHERE sku = $1`, [sku]);
  if (check.rows.length) {
    process.stdout.write(`SKIP (exists): ${sku}\n`);
    return;
  }

  const id = cuid();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, sku, name, "FITTING_KIT", "Each", reorderPoint, true, now, now]
  );

  // Opening stock — Brisbane
  const logId = cuid();
  await pool.query(
    `INSERT INTO "InventoryLog" (id, "productId", "locationId", type, delta, "enteredBy", notes, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [logId, id, brisbane.id, "opening_stock", qty, "import", "Opening stock on import", now]
  );

  process.stdout.write(`✅ ${sku} | ${name} | FITTING_KIT | Each | qty:${qty} | reorder:${reorderPoint}\n`);
  process.stdout.write("Done.\n");
}

main().catch(console.error).finally(() => pool.end());
