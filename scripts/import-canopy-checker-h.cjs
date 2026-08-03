// Import checker-plate Raw Alloy canopy SKUs (opening stock = 0)
// Run: node scripts/import-canopy-checker-h.cjs
const { Pool } = require('pg');
const { randomBytes } = require('crypto');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function cuid() {
  return 'c' + randomBytes(11).toString('hex');
}

const SKUS = [
  {
    sku: 'CD-2D-17168H',
    name: '2 Door Base Canopy 1775 x 1600 x 850 Raw Alloy Checker Plate',
  },
  {
    sku: 'CD-2D-17188H',
    name: '2 Door Base Canopy 1775 x 1800 x 850 Raw Alloy Checker Plate',
  },
];

const CATEGORY = 'CANOPY';
const UNIT = 'Each';
const REORDER_POINT = 2; // same as sibling CD-2D-17168 / CD-2D-17188

async function main() {
  for (const item of SKUS) {
    const existing = await pool.query('SELECT id FROM "Product" WHERE sku = $1', [item.sku]);
    if (existing.rows.length) {
      console.log(`SKIP (exists): ${item.sku}`);
      continue;
    }

    const productId = cuid();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [productId, item.sku, item.name, CATEGORY, UNIT, REORDER_POINT, true, now, now]
    );
    console.log(`CREATED: ${item.sku} — ${item.name} | ${CATEGORY} | reorder=${REORDER_POINT} | opening=0 (no log)`);
  }

  console.log('\nDone.');
}

main().catch(console.error).finally(() => pool.end());
