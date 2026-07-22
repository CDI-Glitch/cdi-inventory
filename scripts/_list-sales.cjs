// List all Sales Records for review
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
    `SELECT sr."recordId", sr.customer, sr."itemCode", sr.qty, sr.status, sr."saleType", l.name AS location, sr."createdAt"
     FROM "SalesRecord" sr
     LEFT JOIN "Location" l ON l.id = sr."locationId"
     ORDER BY sr."createdAt" ASC`
  );
  if (!res.rows.length) {
    process.stdout.write("No Sales Records found.\n");
    return;
  }
  process.stdout.write(`Found ${res.rows.length} record(s):\n\n`);
  for (const r of res.rows) {
    process.stdout.write(`  ${r.recordId} | ${r.customer} | ${r.itemCode} x${r.qty} | ${r.status} | ${r.saleType} | ${r.location} | ${r.createdAt}\n`);
  }
}

main().catch(console.error).finally(() => pool.end());
