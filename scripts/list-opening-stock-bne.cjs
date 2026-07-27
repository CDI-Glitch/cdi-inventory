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
  const res = await pool.query(`
    SELECT
      p.sku,
      p.name,
      p.category,
      SUM(il.delta) AS opening_qty,
      MIN(il."createdAt") AS recorded_at
    FROM "InventoryLog" il
    JOIN "Product" p ON p.id = il."productId"
    JOIN "Location" l ON l.id = il."locationId"
    WHERE l.name = 'Brisbane'
      AND il.type = 'opening_stock'
    GROUP BY p.sku, p.name, p.category
    ORDER BY p.category, p.sku
  `);

  console.log('\n=== Brisbane Opening Stock ===');
  console.log('Total SKUs with opening stock:', res.rows.length);
  console.table(res.rows);

  // Also list active SKUs with NO opening stock at Brisbane
  const res2 = await pool.query(`
    SELECT p.sku, p.name, p.category
    FROM "Product" p
    WHERE p.active = true
      AND NOT EXISTS (
        SELECT 1 FROM "InventoryLog" il
        JOIN "Location" l ON l.id = il."locationId"
        WHERE il."productId" = p.id
          AND l.name = 'Brisbane'
          AND il.type = 'opening_stock'
      )
    ORDER BY p.category, p.sku
  `);
  console.log('\n=== Active SKUs with NO opening stock at Brisbane ===');
  console.log('Count:', res2.rows.length);
  console.table(res2.rows);
}

main().catch(console.error).finally(() => pool.end());
