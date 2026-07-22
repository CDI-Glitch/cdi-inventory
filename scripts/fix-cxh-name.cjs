// Fix CXH name: Under Tray Harness Cover → Under Body Harness Cover
const { Pool } = require("pg");

const pool = new Pool({
  host: "tokaido.proxy.rlwy.net",
  port: 43176,
  user: "postgres",
  password: "SHufVETPyuJhEckjrUldCjPZPkxrkVvv",
  database: "railway",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const res = await pool.query(
    `UPDATE "Product" SET name = 'Under Body Harness Cover', "updatedAt" = $1 WHERE sku = 'CXH' RETURNING sku, name`,
    [new Date().toISOString()]
  );
  process.stdout.write(`✅ Updated: ${JSON.stringify(res.rows[0])}\n`);
}

main().catch(console.error).finally(() => pool.end());
