// Creates Brisbane Sales Manager account (admin role)
// Run: node scripts/create-bne-manager.cjs
const { Pool } = require('pg');
const { randomBytes, createHash } = require('crypto');

const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net',
  port: 43176,
  user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

// bcrypt is not available in plain Node without install, so we use a pre-hashed
// password generated offline. Password: cdi2026manager!
// bcrypt hash (cost 10) generated via: bcrypt.hashSync('cdi2026manager!', 10)
const PASSWORD_PLAIN = 'cdi2026manager!';
const EMAIL = 'salesmanager.bne@cdi.com.au';
const NAME = 'Brisbane Sales Manager';
const ROLE = 'admin';

async function main() {
  // Check if bcryptjs is available
  let bcrypt;
  try {
    bcrypt = require('bcryptjs');
  } catch {
    console.error('bcryptjs not found. Run: npm install bcryptjs');
    process.exit(1);
  }

  // Check if user already exists
  const existing = await pool.query('SELECT id FROM "User" WHERE email = $1', [EMAIL]);
  if (existing.rows.length > 0) {
    console.log(`User ${EMAIL} already exists (id: ${existing.rows[0].id}). Aborting.`);
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 10);
  const id = 'c' + randomBytes(11).toString('hex');
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO "User" (id, email, "passwordHash", name, role, active, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, EMAIL, passwordHash, NAME, ROLE, true, now]
  );

  console.log('✅ Created user:');
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Name:     ${NAME}`);
  console.log(`   Role:     ${ROLE}`);
  console.log(`   Password: ${PASSWORD_PLAIN}`);
  console.log(`   ID:       ${id}`);
}

main().catch(console.error).finally(() => pool.end());
