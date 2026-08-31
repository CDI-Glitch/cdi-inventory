// 2-door Jack Off canopies, matching CD-3D-17188JKC naming (Raw / SHB / W).
// Run: node scripts/import-cd-2d-jkc.cjs
const { Pool } = require("pg");
const { randomBytes } = require("crypto");
require("dotenv").config({ path: ".env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});

function cuid() {
  return "c" + randomBytes(11).toString("hex");
}

const COLORS = [
  { suffix: "", name: "Raw Alloy" },
  { suffix: "-SHB", name: "Sahara Black" },
  { suffix: "-W", name: "Splash White" },
];

const SIZES = [
  { code: "17128", length: "1200" },
  { code: "17148", length: "1400" },
  { code: "17168", length: "1600" },
  { code: "17188", length: "1800" },
];

const SKUS = SIZES.flatMap((size) =>
  COLORS.map((color) => ({
    sku: `CD-2D-${size.code}JKC${color.suffix}`,
    name: `2 Door Base Canopy 1775 x ${size.length} x 850 Jack Off ${color.name}`,
  }))
);

const CATEGORY = "CANOPY";
const UNIT = "Each";
const REORDER_POINT = 2;

async function main() {
  for (const item of SKUS) {
    const existing = await pool.query(`SELECT id FROM "Product" WHERE sku = $1`, [item.sku]);
    if (existing.rows.length) {
      console.log(`SKIP (exists): ${item.sku}`);
      continue;
    }

    const productId = cuid();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [productId, item.sku, item.name, CATEGORY, UNIT, REORDER_POINT, true, now, now]
    );
    console.log(`CREATED: ${item.sku} — ${item.name}`);
  }
  console.log("\nDone. 12 SKUs, CANOPY, Each, reorder=2, opening=0.");
}

main().catch(console.error).finally(() => pool.end());
