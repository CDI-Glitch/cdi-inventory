// Delete SR-0001 test record and all associated data
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
  const rec = await pool.query(`SELECT id, "recordId" FROM "SalesRecord" WHERE "recordId" = 'SR-0001'`);
  if (!rec.rows.length) { process.stdout.write("SR-0001 not found.\n"); return; }

  const { id, recordId } = rec.rows[0];

  // Delete GeneratedMovements
  const mv = await pool.query(`DELETE FROM "GeneratedMovement" WHERE "salesRecordId" = $1`, [id]);
  process.stdout.write(`Deleted ${mv.rowCount} GeneratedMovement(s)\n`);

  // Delete SalesRecord
  await pool.query(`DELETE FROM "SalesRecord" WHERE id = $1`, [id]);
  process.stdout.write(`✅ Deleted ${recordId}\n`);
}

main().catch(console.error).finally(() => pool.end());
