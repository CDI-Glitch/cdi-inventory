// Import R3D-17188F — legacy 1.8m 3-Door flat plate Raw Alloy canopy
// Run: node scripts/import-r3d-17188f.cjs
const { Pool } = require('pg');
const { randomBytes } = require('crypto');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function cuid() {
  return 'c' + randomBytes(11).toString('hex');
}

const SKU = {
  sku: 'R3D-17188F',
  name: '1.8m 3-Door Flat Plate Canopy Raw Alloy (Legacy)',
};

const CATEGORY = 'CANOPY';
const UNIT = 'Each';
const REORDER_POINT = 0; // legacy — no reorder, same as R3D-17188JKCB/W

async function main() {
  const existing = await pool.query('SELECT id FROM "Product" WHERE sku = $1', [SKU.sku]);
  if (existing.rows.length) {
    console.log(`SKIP (exists): ${SKU.sku}`);
    await pool.end();
    return;
  }

  const productId = cuid();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [productId, SKU.sku, SKU.name, CATEGORY, UNIT, REORDER_POINT, true, now, now]
  );
  console.log(`CREATED: ${SKU.sku} — ${SKU.name} | ${CATEGORY} | reorder=${REORDER_POINT} | opening=0 (no log)`);
  console.log('\nDone.');
}

main().catch(console.error).finally(() => pool.end());
