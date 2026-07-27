// Add opening_stock +1 for CD-2D-17128 at Brisbane
// This corrects the missing opening stock entry (SKU was sold via SR-0001 before stock was recorded)
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

async function main() {
  // Get productId and locationId
  const prod = await pool.query(`SELECT id FROM "Product" WHERE sku = 'CD-2D-17128' LIMIT 1`);
  if (prod.rows.length === 0) throw new Error('SKU CD-2D-17128 not found');
  const productId = prod.rows[0].id;

  const loc = await pool.query(`SELECT id FROM "Location" WHERE name = 'Brisbane' LIMIT 1`);
  if (loc.rows.length === 0) throw new Error('Brisbane location not found');
  const locationId = loc.rows[0].id;

  // Check current state
  const current = await pool.query(`
    SELECT SUM(delta) AS on_hand FROM "InventoryLog"
    WHERE "productId" = $1 AND "locationId" = $2
  `, [productId, locationId]);
  console.log('Current on_hand before fix:', current.rows[0].on_hand);

  // Insert opening_stock +1
  const id = randomBytes(12).toString('hex');
  await pool.query(`
    INSERT INTO "InventoryLog" (id, "productId", "locationId", type, delta, reference, "enteredBy", notes, "createdAt")
    VALUES ($1, $2, $3, 'opening_stock', 1, NULL, 'system', 'Opening stock correction — backdated', NOW())
  `, [id, productId, locationId]);

  // Verify
  const after = await pool.query(`
    SELECT SUM(delta) AS on_hand FROM "InventoryLog"
    WHERE "productId" = $1 AND "locationId" = $2
  `, [productId, locationId]);
  console.log('on_hand after fix:', after.rows[0].on_hand);
  console.log('Done. CD-2D-17128 Brisbane opening_stock +1 applied.');
}

main().catch(console.error).finally(() => pool.end());
