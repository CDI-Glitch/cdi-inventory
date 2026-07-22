const { Pool } = require('pg');
require('dotenv').config();

const url = new URL(process.env.DATABASE_URL);
const pool = new Pool({
  host: url.hostname,
  port: Number(url.port),
  user: url.username,
  password: url.password,
  database: url.pathname.replace('/', ''),
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM "IncomingLine"');
    const r = await client.query('DELETE FROM "IncomingShipment" RETURNING "poRef"');
    await client.query('COMMIT');
    console.log('Deleted shipments:', r.rows.map((x) => x.poRef).join(', ') || '(none)');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
