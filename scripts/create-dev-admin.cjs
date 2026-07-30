// Creates a dedicated Dev admin account, separate from the shared admin@cdi.com.au
// Run: node scripts/create-dev-admin.cjs
const { Pool } = require('pg');
const { randomBytes } = require('crypto');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMAIL = 'dev@cdi.com.au';
const PASSWORD_PLAIN = 'cdAlexPDev0729@_';
const NAME = 'CDI Dev';
const ROLE = 'admin';

function cuid() {
  return 'c' + randomBytes(11).toString('hex');
}

async function main() {
  let bcrypt;
  try {
    bcrypt = require('bcryptjs');
  } catch {
    console.error('bcryptjs not found. Run: npm install bcryptjs');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM "User" WHERE email = $1', [EMAIL]);
    if (existing.rows.length > 0) {
      console.log(`Account already exists: ${EMAIL}. Aborting.`);
      return;
    }

    const id = cuid();
    const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 10);
    const now = new Date().toISOString();

    await client.query(
      `INSERT INTO "User" (id, email, "passwordHash", name, role, active, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, EMAIL, passwordHash, NAME, ROLE, true, now]
    );

    console.log(`Created: ${EMAIL} | role=${ROLE} | active=true`);
    console.log(`   Password: ${PASSWORD_PLAIN}`);
  } finally {
    client.release();
  }
}

main().catch(console.error).finally(() => pool.end());
