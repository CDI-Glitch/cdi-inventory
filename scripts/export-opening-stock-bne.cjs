const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net',
  port: 43176,
  user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

function toCsv(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map(row =>
    columns.map(col => {
      const val = row[col] ?? '';
      return String(val).includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

async function main() {
  // All active SKUs with opening stock status
  const res = await pool.query(`
    SELECT
      p.sku,
      p.name,
      p.category,
      COALESCE(SUM(CASE WHEN il.type = 'opening_stock' THEN il.delta END), 0) AS opening_qty,
      COALESCE(SUM(il.delta), 0) AS current_on_hand,
      CASE WHEN SUM(CASE WHEN il.type = 'opening_stock' THEN 1 ELSE 0 END) > 0
           THEN 'YES' ELSE 'NO' END AS has_opening_stock
    FROM "Product" p
    LEFT JOIN "InventoryLog" il ON il."productId" = p.id
      AND il."locationId" = (SELECT id FROM "Location" WHERE name = 'Brisbane' LIMIT 1)
    WHERE p.active = true
    GROUP BY p.sku, p.name, p.category
    ORDER BY p.category, p.sku
  `);

  const outPath = path.join(__dirname, '..', 'exports', 'bne-opening-stock.csv');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const csv = toCsv(res.rows, ['sku', 'name', 'category', 'opening_qty', 'current_on_hand', 'has_opening_stock']);
  fs.writeFileSync(outPath, csv, 'utf8');

  console.log(`\nExported ${res.rows.length} rows to: ${outPath}`);
  console.log('\nSummary:');
  const withStock = res.rows.filter(r => r.has_opening_stock === 'YES').length;
  const withoutStock = res.rows.filter(r => r.has_opening_stock === 'NO').length;
  console.log(`  Has opening stock: ${withStock}`);
  console.log(`  No opening stock:  ${withoutStock}`);
}

main().catch(console.error).finally(() => pool.end());
