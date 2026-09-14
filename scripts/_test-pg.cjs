// Quick connectivity test for Railway Postgres
// Run: node scripts/_test-pg.cjs
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.query('SELECT count(*) as cnt FROM "Product"')
  .then(r => process.stdout.write('OK: ' + r.rows[0].cnt + ' products\n'))
  .catch(e => process.stdout.write('FAIL: ' + e.code + ' | ' + e.message + '\n'))
  .finally(() => pool.end());
