// Revert T-Tray-1605-SHB name back to original
// Run: node scripts/revert-tray-1605-name.cjs
const { Pool } = require('pg');
const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net', port: 43176, user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv', database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const originalName = 'T Tray Deck 1775 x 1605 Sahara Black';
  const result = await pool.query(
    `UPDATE "Product" SET name = $1, "updatedAt" = $2 WHERE sku = 'T-Tray-1605-SHB' RETURNING sku, name`,
    [originalName, new Date().toISOString()]
  );
  if (!result.rows.length) { console.log('SKU not found'); return; }
  console.log('Reverted:', result.rows[0].sku, '|', result.rows[0].name);
}

main().catch(console.error).finally(() => pool.end());
