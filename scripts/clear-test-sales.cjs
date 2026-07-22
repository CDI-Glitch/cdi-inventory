const { Pool } = require('pg');
require('dotenv').config();

const url = new URL(process.env.DATABASE_URL);
const pool = new Pool({
  host: url.hostname,
  port: Number(url.port),
  user: url.username,
  password: url.password,
  database: url.pathname.replace('/', ''),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Show what we're about to delete
    const { rows: records } = await client.query(
      'SELECT "recordId", status, customer FROM "SalesRecord" ORDER BY "createdAt"'
    );
    console.log('Sales records to delete:');
    records.forEach(r => console.log(`  ${r.recordId}  [${r.status}]  ${r.customer}`));

    const { rows: logs } = await client.query(
      `SELECT COUNT(*) as n FROM "InventoryLog" WHERE type IN ('sales_deduction','reservation_adjustment')`
    );
    console.log(`InventoryLog rows to delete: ${logs[0].n}`);

    // 2. Delete InventoryLog rows from sales (sales_deduction + reservation_adjustment)
    await client.query(
      `DELETE FROM "InventoryLog" WHERE type IN ('sales_deduction', 'reservation_adjustment')`
    );

    // 3. Delete GeneratedMovement
    await client.query('DELETE FROM "GeneratedMovement"');

    // 4. Delete SalesLine
    await client.query('DELETE FROM "SalesLine"');

    // 5. Delete SalesRecord
    await client.query('DELETE FROM "SalesRecord"');

    await client.query('COMMIT');
    console.log('\nDone — all test sales cleared, inventory restored.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ROLLBACK:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
