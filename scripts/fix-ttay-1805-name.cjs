// Fix typo in Ttay-1805-SHB display name (Ttay → Tray)
// Run: node scripts/fix-ttay-1805-name.cjs
const { Pool } = require('pg');
const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net', port: 43176, user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv', database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const result = await pool.query(
    `UPDATE "Product" SET name = $1, "updatedAt" = $2 WHERE sku = 'Ttay-1805-SHB' RETURNING sku, name`,
    ['T Tray Deck 1775 x 1805 Sahara Black (Legacy)', new Date().toISOString()]
  );
  if (!result.rows.length) { console.log('SKU not found'); return; }
  console.log('Fixed:', result.rows[0].sku, '|', result.rows[0].name);
}

main().catch(console.error).finally(() => pool.end());
