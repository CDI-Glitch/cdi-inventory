// Creates Sydney Sales account (Cyrus) — sales role
// Run: node scripts/create-cyrus-sales.cjs
// Idempotent: aborts if email already exists.
// Initial password archived in docs/auth-permissions-runbook.md §5.1
const { Pool } = require("pg");
const { randomBytes } = require("crypto");
require("dotenv").config({ quiet: true });

const dbUrl = new URL(process.env.DATABASE_URL);
const pool = new Pool({
  host: dbUrl.hostname,
  port: Number(dbUrl.port || 5432),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const PASSWORD_PLAIN = "Cyrus$yd#Inv2026";
const EMAIL = "cyrus@cdi.com.au";
const NAME = "Cyrus";
const ROLE = "sales";

async function main() {
  let bcrypt;
  try {
    bcrypt = require("bcryptjs");
  } catch {
    console.error("bcryptjs not found. Run: npm install bcryptjs");
    process.exit(1);
  }

  const existing = await pool.query('SELECT id, role, active FROM "User" WHERE email = $1', [EMAIL]);
  if (existing.rows.length > 0) {
    console.log(`User ${EMAIL} already exists (id: ${existing.rows[0].id}, role: ${existing.rows[0].role}). Aborting.`);
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 12);
  const id = "c" + randomBytes(11).toString("hex");
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO "User" (id, email, "passwordHash", name, role, active, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, EMAIL, passwordHash, NAME, ROLE, true, now]
  );

  console.log("Created user:");
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Name:     ${NAME}`);
  console.log(`   Role:     ${ROLE}`);
  console.log(`   Password: ${PASSWORD_PLAIN}`);
  console.log(`   ID:       ${id}`);
}

main()
  .catch(console.error)
  .finally(() => pool.end());
