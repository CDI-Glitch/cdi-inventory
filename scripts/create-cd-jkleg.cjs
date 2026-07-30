const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Check for duplicate
    const existing = await client.query(
      `SELECT id FROM "Product" WHERE sku = 'CD-JKLEG'`
    );
    if (existing.rows.length > 0) {
      console.log('SKU CD-JKLEG already exists. Aborting.');
      return;
    }

    const result = await client.query(
      `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'CD-JKLEG', 'Canopy Jack Off Leg', 'CANOPY_ACCESSORY', 'Each', 0, true, NOW(), NOW())
       RETURNING id, sku, name, category, unit`,
    );

    const p = result.rows[0];
    console.log(`Created: [${p.sku}] ${p.name} | ${p.category} | ${p.unit}`);
    console.log('Opening stock = 0 for both Brisbane and Sydney (no InventoryLog needed).');
  } finally {
    client.release();
  }
}

main().catch(console.error).finally(() => pool.end());
