// Rename T-Tray-1605-SHB to match Ttay-1805-SHB Legacy naming convention
// Run: node scripts/rename-tray-1605-legacy.cjs
const { Pool } = require('pg');
const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net', port: 43176, user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv', database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check current state
  const before = await pool.query(`SELECT id, sku, name FROM "Product" WHERE sku = 'T-Tray-1605-SHB'`);
  if (!before.rows.length) { console.log('SKU T-Tray-1605-SHB not found'); return; }
  const row = before.rows[0];
  console.log('Before:', row.sku, '|', row.name);

  const newName = 'T Tray Deck 1775 x 1605 Sahara Black (Legacy)';
  await pool.query(
    `UPDATE "Product" SET name = $1, "updatedAt" = $2 WHERE id = $3`,
    [newName, new Date().toISOString(), row.id]
  );

  console.log('After: ', row.sku, '|', newName);
  console.log('Done.');
}

main().catch(console.error).finally(() => pool.end());
