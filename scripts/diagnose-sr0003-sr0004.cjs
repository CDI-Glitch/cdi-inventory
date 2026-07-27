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
  // SR-0003 and SR-0004 status + movements
  const q1 = await pool.query(`
    SELECT
      sr."recordId", sr.status,
      p.sku, gm."reservedQty"
    FROM "GeneratedMovement" gm
    JOIN "SalesRecord" sr ON sr.id = gm."salesRecordId"
    JOIN "Product" p ON p.id = gm."productId"
    WHERE sr."recordId" IN ('SR-0003', 'SR-0004')
    ORDER BY sr."recordId", p.sku
  `);
  console.log('\n=== SR-0003 and SR-0004 movements ===');
  console.table(q1.rows);

  // All cancelled SRs with reservedQty > 0 (should be none)
  const q2 = await pool.query(`
    SELECT
      sr."recordId", sr.status,
      p.sku, gm."reservedQty"
    FROM "GeneratedMovement" gm
    JOIN "SalesRecord" sr ON sr.id = gm."salesRecordId"
    JOIN "Product" p ON p.id = gm."productId"
    WHERE sr.status = 'cancelled'
      AND gm."reservedQty" > 0
    ORDER BY sr."recordId", p.sku
  `);
  console.log('\n=== Dirty rows: cancelled SR with reservedQty > 0 ===');
  console.log('Count:', q2.rows.length);
  if (q2.rows.length > 0) console.table(q2.rows);
  else console.log('None found.');
}

main().catch(console.error).finally(() => pool.end());
