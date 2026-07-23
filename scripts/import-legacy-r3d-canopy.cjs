// Import legacy R3D 1.8m 3-Door Jack Off Canopy SKUs (Black + White)
// Run: node scripts/import-legacy-r3d-canopy.cjs
const { Pool } = require('pg');
const { randomBytes } = require('crypto');

const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net',
  port: 43176,
  user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

function cuid() {
  return 'c' + randomBytes(11).toString('hex');
}

const SKUS = [
  {
    sku: 'R3D-17188JKCB',
    name: '1.8m 3-Door Jack Off Canopy Scylla Black (Legacy)',
    openingQty: 3,
  },
  {
    sku: 'R3D-17188JKCW',
    name: '1.8m 3-Door Jack Off Canopy Splash White (Legacy)',
    openingQty: 3,
  },
];

const CATEGORY = 'CANOPY';
const UNIT = 'Each';
const REORDER_POINT = 0;
const LOCATION_NAME = 'Brisbane';
const LOG_TYPE = 'opening_stock';
const ENTERED_BY = 'system';

async function main() {
  // Get Brisbane location ID
  const locResult = await pool.query('SELECT id FROM "Location" WHERE name = $1', [LOCATION_NAME]);
  if (!locResult.rows.length) {
    console.error(`Location "${LOCATION_NAME}" not found.`);
    process.exit(1);
  }
  const locationId = locResult.rows[0].id;

  for (const item of SKUS) {
    // Check if SKU already exists
    const existing = await pool.query('SELECT id FROM "Product" WHERE sku = $1', [item.sku]);
    if (existing.rows.length) {
      console.log(`SKIP (exists): ${item.sku}`);
      continue;
    }

    // Create Product
    const productId = cuid();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [productId, item.sku, item.name, CATEGORY, UNIT, REORDER_POINT, true, now, now]
    );
    console.log(`CREATED product: ${item.sku} — ${item.name}`);

    // Create opening_stock InventoryLog
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
        'Legacy stock imported on portal setup',
        now,
      ]
    );
    console.log(`  -> opening_stock log: +${item.openingQty} at ${LOCATION_NAME}`);
  }

  console.log('\nDone.');
}

main().catch(console.error).finally(() => pool.end());
