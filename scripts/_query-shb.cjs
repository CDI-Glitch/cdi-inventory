const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.query(`SELECT sku, name, category FROM "Product" WHERE sku ILIKE '%SHB%' OR sku ILIKE '%1605%' OR name ILIKE '%shb%' ORDER BY sku`)
  .then(r => {
    if (!r.rows.length) { console.log('No results'); return; }
    r.rows.forEach(x => console.log(x.sku, '|', x.name, '|', x.category));
  })
  .catch(console.error)
  .finally(() => pool.end());
