/**
 * Add T-Tray deck flat-plate SKUs (F suffix). Existing unsuffixed decks remain
 * checker plate. Colour suffixes match current decks: raw / -SHB / -W.
 * Does not create or change sellable bundles.
 *
 * Run: npx tsx scripts/import-t-tray-flat-decks.ts
 */
import "dotenv/config";
import { Pool } from "pg";
import { randomBytes } from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const SIZES = ["1605", "1805", "2105", "2405"] as const;
const COLOURS = [
  { suffix: "", label: "Raw Alloy" },
  { suffix: "-SHB", label: "Sahara Black" },
  { suffix: "-W", label: "Splash White" },
] as const;

function cuid() {
  return "c" + randomBytes(11).toString("hex");
}

async function main() {
  let created = 0;
  let skipped = 0;

  for (const size of SIZES) {
    for (const colour of COLOURS) {
      const sku = `T-Tray-${size}F${colour.suffix}`;
      const name = `T Tray Deck 1775 x ${size} Flat Plate ${colour.label}`;

      const existing = await pool.query('SELECT id FROM "Product" WHERE sku = $1', [sku]);
      if (existing.rowCount && existing.rowCount > 0) {
        console.log(`SKIP (exists): ${sku}`);
        skipped++;
        continue;
      }

      const id = cuid();
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, sku, name, "TRAY_DECK", "Each", 10, true, now, now]
      );
      console.log(`CREATED: ${sku} | ${name}`);
      created++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
