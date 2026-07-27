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
  // All InventoryLog entries for CD-2D-17128
  const q1 = await pool.query(`
    SELECT
      il.type, il.delta, il.reference, il.notes, il."enteredBy", il."createdAt",
      l.name AS location
    FROM "InventoryLog" il
    JOIN "Product" p ON p.id = il."productId"
    JOIN "Location" l ON l.id = il."locationId"
    WHERE p.sku = 'CD-2D-17128'
    ORDER BY il."createdAt"
  `);
  console.log('\n=== InventoryLog for CD-2D-17128 ===');
  console.table(q1.rows);

  // All GeneratedMovement for CD-2D-17128
  const q2 = await pool.query(`
    SELECT
      gm."reservedQty", sr."recordId", sr.status, l.name AS location
    FROM "GeneratedMovement" gm
    JOIN "Product" p ON p.id = gm."productId"
    JOIN "SalesRecord" sr ON sr.id = gm."salesRecordId"
    JOIN "Location" l ON l.id = gm."locationId"
    WHERE p.sku = 'CD-2D-17128'
    ORDER BY sr."recordId"
  `);
  console.log('\n=== GeneratedMovement for CD-2D-17128 ===');
  console.table(q2.rows);
}

main().catch(console.error).finally(() => pool.end());
