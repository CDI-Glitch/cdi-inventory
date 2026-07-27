// Set shopifyLocationId for Brisbane and Sydney
const { Pool } = require('pg');

const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net',
  port: 43176,
  user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const updates = [
    { name: 'Brisbane', shopifyLocationId: '112920068395' },
    { name: 'Sydney',   shopifyLocationId: '115677495595' },
  ];

  for (const { name, shopifyLocationId } of updates) {
    const res = await pool.query(
      `UPDATE "Location" SET "shopifyLocationId" = $1 WHERE name = $2 RETURNING id, name, "shopifyLocationId"`,
      [shopifyLocationId, name]
    );
    if (res.rows.length === 0) {
      console.log(`WARNING: location "${name}" not found`);
    } else {
      console.log(`OK: ${res.rows[0].name} → shopifyLocationId = ${res.rows[0].shopifyLocationId}`);
    }
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
