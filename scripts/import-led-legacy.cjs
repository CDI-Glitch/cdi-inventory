// Import legacy 12V Dual Colour LED Strip Light SKUs
// Run: node scripts/import-led-legacy.cjs
const { Pool } = require('pg');
const { randomBytes } = require('crypto');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function cuid() {
  return 'c' + randomBytes(11).toString('hex');
}

const SKUS = [
  {
    sku: 'CD-LED100-MK1',
    name: '12V Dual Colour LED Strip Light 1000mm (Legacy)',
    openingQty: 50,
  },
  {
    sku: 'CD-LED60-MK1',
    name: '12V Dual Colour LED Strip Light 600mm (Legacy)',
    openingQty: 50,
  },
];

const CATEGORY = '12V';
const UNIT = 'Each';
const REORDER_POINT = 0;
const LOCATION_NAME = 'Brisbane';
const LOG_TYPE = 'opening_stock';
const ENTERED_BY = 'system';

async function main() {
  const locResult = await pool.query('SELECT id FROM "Location" WHERE name = $1', [LOCATION_NAME]);
  if (!locResult.rows.length) {
    console.error(`Location "${LOCATION_NAME}" not found.`);
    process.exit(1);
  }
  const locationId = locResult.rows[0].id;

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
    console.log(`CREATED product: ${item.sku} — ${item.name}`);

    const logId = cuid();
    await pool.query(
      `INSERT INTO "InventoryLog" (id, "productId", "locationId", type, delta, reference, "enteredBy", notes, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        logId,
        productId,
        locationId,
        LOG_TYPE,
        item.openingQty,
        'legacy-import',
        ENTERED_BY,
        'Legacy LED strip opening stock',
        now,
      ]
    );
    console.log(`  -> opening_stock log: +${item.openingQty} at ${LOCATION_NAME}`);
  }

  console.log('\nDone.');
}

main().catch(console.error).finally(() => pool.end());
