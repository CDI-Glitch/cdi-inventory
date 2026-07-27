// Diagnose: find completed SalesRecords that still have GeneratedMovement.reservedQty > 0
const { Pool } = require('pg');

const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net',
  port: 43176,
  user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // Query 1: all completed SRs with dirty reservedQty
  const q1 = await pool.query(`
    SELECT
      sr."recordId",
      sr.status,
      p.sku,
      gm."reservedQty",
      gm.id AS movement_id
    FROM "GeneratedMovement" gm
    JOIN "SalesRecord" sr ON sr.id = gm."salesRecordId"
    JOIN "Product" p ON p.id = gm."productId"
    WHERE sr.status = 'completed'
      AND gm."reservedQty" > 0
    ORDER BY sr."recordId", p.sku
  `);

  console.log('\n=== Dirty rows: completed SR with reservedQty > 0 ===');
  console.log('Count:', q1.rows.length);
  if (q1.rows.length > 0) {
    console.table(q1.rows);
  } else {
    console.log('None found.');
  }

  // Query 2: all movements for SR-0005
  const q2 = await pool.query(`
    SELECT
      p.sku,
      gm."reservedQty",
      gm.id
    FROM "GeneratedMovement" gm
    JOIN "Product" p ON p.id = gm."productId"
    JOIN "SalesRecord" sr ON sr.id = gm."salesRecordId"
    WHERE sr."recordId" = 'SR-0005'
    ORDER BY p.sku
  `);

  console.log('\n=== All GeneratedMovement rows for SR-0005 ===');
  console.table(q2.rows);
}

main().catch(console.error).finally(() => pool.end());
