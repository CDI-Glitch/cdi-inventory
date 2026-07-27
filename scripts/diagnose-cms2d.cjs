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
  // All GeneratedMovement rows for CMS-2D-18189-SHB regardless of reservedQty
  const q1 = await pool.query(`
    SELECT
      gm.id,
      gm."reservedQty",
      sr."recordId",
      sr.status,
      l.name AS location
    FROM "GeneratedMovement" gm
    JOIN "SalesRecord" sr ON sr.id = gm."salesRecordId"
    JOIN "Product" p ON p.id = gm."productId"
    JOIN "Location" l ON l.id = gm."locationId"
    WHERE p.sku = 'CMS-2D-18189-SHB'
    ORDER BY gm."reservedQty" DESC, sr."recordId"
  `);
  console.log('\n=== All GeneratedMovement for CMS-2D-18189-SHB ===');
  console.table(q1.rows);

  // Raw SUM used by inventory page
  const q2 = await pool.query(`
    SELECT
      SUM(gm."reservedQty") AS total_reserved
    FROM "GeneratedMovement" gm
    JOIN "Product" p ON p.id = gm."productId"
    JOIN "Location" l ON l.id = gm."locationId"
    WHERE p.sku = 'CMS-2D-18189-SHB'
      AND l.name = 'Brisbane'
      AND gm."reservedQty" > 0
  `);
  console.log('\n=== SUM(reservedQty) for CMS-2D-18189-SHB @ Brisbane ===');
  console.table(q2.rows);

  // InventoryLog sum (onHand)
  const q3 = await pool.query(`
    SELECT
      SUM(il.delta) AS total_on_hand
    FROM "InventoryLog" il
    JOIN "Product" p ON p.id = il."productId"
    JOIN "Location" l ON l.id = il."locationId"
    WHERE p.sku = 'CMS-2D-18189-SHB'
      AND l.name = 'Brisbane'
  `);
  console.log('\n=== SUM(delta) / onHand for CMS-2D-18189-SHB @ Brisbane ===');
  console.table(q3.rows);
}

main().catch(console.error).finally(() => pool.end());
