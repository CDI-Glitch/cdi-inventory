// One-off: create CMS hardware quick-pack bundles (Dual/Extra Cab + Single Cab).
// Run: node scripts/create-cms-hw-bundles.cjs
const { Pool } = require('pg');
const { randomBytes } = require('crypto');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function cuid() {
  return 'c' + randomBytes(11).toString('hex');
}

const COMPONENT_SKUS = ['FK', 'TT-BN-BX/MG', 'TT-BN-DNP', 'TT-BN-FK', 'CXH'];

const BUNDLES = [
  {
    code: 'BDL-CMS-HW-DUALCAB',
    name: 'CMS Hardware Kit — Dual/Extra Cab',
    productFamily: 'CMS',
    components: [
      { sku: 'FK', qty: 3 },
      { sku: 'TT-BN-BX/MG', qty: 1 },
      { sku: 'TT-BN-DNP', qty: 1 },
      { sku: 'TT-BN-FK', qty: 1 },
      { sku: 'CXH', qty: 1 },
    ],
  },
  {
    code: 'BDL-CMS-HW-SINGLECAB',
    name: 'CMS Hardware Kit — Single Cab',
    productFamily: 'CMS',
    components: [
      { sku: 'FK', qty: 4 },
      { sku: 'TT-BN-BX/MG', qty: 1 },
      { sku: 'TT-BN-DNP', qty: 1 },
      { sku: 'TT-BN-FK', qty: 1 },
      { sku: 'CXH', qty: 1 },
    ],
  },
];

async function main() {
  const client = await pool.connect();
  try {
    // Resolve product IDs
    const { rows: products } = await client.query(
      `SELECT id, sku FROM "Product" WHERE sku = ANY($1)`,
      [COMPONENT_SKUS]
    );
    const bySku = Object.fromEntries(products.map((p) => [p.sku, p.id]));
    for (const sku of COMPONENT_SKUS) {
      if (!bySku[sku]) {
        console.error(`Missing product SKU: ${sku}`);
        process.exit(1);
      }
    }
    console.log('Resolved products:', bySku);

    for (const b of BUNDLES) {
      const existing = await client.query(
        `SELECT id FROM "BundleDefinition" WHERE code = $1`,
        [b.code]
      );
      if (existing.rows.length > 0) {
        console.log(`Skip (already exists): ${b.code}`);
        continue;
      }

      const bundleId = cuid();
      const now = new Date().toISOString();
      await client.query('BEGIN');
      try {
        await client.query(
          `INSERT INTO "BundleDefinition" (id, code, name, "productFamily", active, "createdAt")
           VALUES ($1, $2, $3, $4, true, $5)`,
          [bundleId, b.code, b.name, b.productFamily, now]
        );

        for (let i = 0; i < b.components.length; i++) {
          const c = b.components[i];
          await client.query(
            `INSERT INTO "BundleItem"
               (id, "bundleId", "productId", qty, "componentRole", required, "sortOrder", notes)
             VALUES ($1, $2, $3, $4, 'hardware_bracket', true, $5, NULL)`,
            [cuid(), bundleId, bySku[c.sku], c.qty, i]
          );
        }
        await client.query('COMMIT');
        console.log(`Created: ${b.code} (${b.components.length} components)`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    // Verify
    const { rows } = await client.query(
      `SELECT b.code, b.name, COUNT(i.id)::int AS components
       FROM "BundleDefinition" b
       LEFT JOIN "BundleItem" i ON i."bundleId" = b.id
       WHERE b.code LIKE 'BDL-CMS-HW-%'
       GROUP BY b.id, b.code, b.name
       ORDER BY b.code`
    );
    console.log('Verification:', rows);
  } finally {
    client.release();
  }
}

main().catch(console.error).finally(() => pool.end());
