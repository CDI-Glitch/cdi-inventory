// Fix SKU typo: Ttay-1805-SHB → Tray-1805-SHB
// InventoryLog references productId (FK), not sku string — no log updates needed
// Run: node scripts/fix-ttay-sku.cjs
const { Pool } = require('pg');
const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net', port: 43176, user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv', database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check target SKU doesn't already exist
  const conflict = await pool.query(`SELECT id FROM "Product" WHERE sku = 'Tray-1805-SHB'`);
  if (conflict.rows.length) {
    console.log('ERROR: Tray-1805-SHB already exists — cannot rename');
    return;
  }

  const result = await pool.query(
    `UPDATE "Product" SET sku = $1, "updatedAt" = $2 WHERE sku = 'Ttay-1805-SHB' RETURNING id, sku, name`,
    ['Tray-1805-SHB', new Date().toISOString()]
  );
  if (!result.rows.length) { console.log('SKU Ttay-1805-SHB not found'); return; }
  console.log('Fixed SKU:', 'Ttay-1805-SHB', '→', result.rows[0].sku);
  console.log('Name:', result.rows[0].name);
  console.log('All InventoryLog entries are linked by productId (FK) — no log updates needed.');
}

main().catch(console.error).finally(() => pool.end());
