// Create legacy Tray-1605-SHB SKU (no opening stock — will be received via Incoming)
// Run: node scripts/create-tray-1605-legacy.cjs
const { Pool } = require('pg');
const { randomBytes } = require('crypto');

const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net', port: 43176, user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv', database: 'railway',
  ssl: { rejectUnauthorized: false }
});

function cuid() {
  return 'c' + randomBytes(11).toString('hex');
}

async function main() {
  const SKU = 'Tray-1605-SHB';
  const NAME = 'T Tray Deck 1775 x 1605 Sahara Black (Legacy)';

  const existing = await pool.query(`SELECT id FROM "Product" WHERE sku = $1`, [SKU]);
  if (existing.rows.length) {
    console.log(`SKIP (exists): ${SKU}`);
    return;
  }

  const id = cuid();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, SKU, NAME, 'TRAY_DECK', 'Each', 0, true, now, now]
  );

  console.log(`CREATED: ${SKU} — ${NAME}`);
}

main().catch(console.error).finally(() => pool.end());
