/**
 * One-off: retire empty TDR-CN shell, then rename live CSM0010 onto that SKU
 * and recategorize CONSUMABLE → GENERAL_ACCESSORY.
 *
 * InventoryLog / IncomingLine / GeneratedMovement / Transfer / BundleItem
 * all key off productId, so the 17-on-hand ledger stays on the same row.
 * SalesLine.itemCode is a frozen SKU string — CSM0010 was CONSUMABLE so it
 * cannot have been a sales SKU line. snapshotItems are not rewritten.
 *
 * Run: npx tsx scripts/upgrade-csm0010-to-tdr-cn.ts
 */
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const NEW_NAME = "Tray Tie-Down Ring Channel Nut (欧标弹片螺母30*M8)";
const NEW_NOTES = "Former SKU CSM0010 (欧标弹片螺母30*M8). Identity upgraded 2026-09-18.";

async function countFor(client: import("pg").PoolClient, table: string, productId: string) {
  const r = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE "productId" = $1`, [productId]);
  return r.rows[0].n as number;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const csm = await client.query('SELECT * FROM "Product" WHERE sku = $1 FOR UPDATE', ["CSM0010"]);
    const shell = await client.query('SELECT * FROM "Product" WHERE sku = $1 FOR UPDATE', ["TDR-CN"]);

    if (csm.rowCount !== 1) throw new Error("Missing product SKU: CSM0010");
    if (shell.rowCount !== 1) throw new Error("Missing product SKU: TDR-CN (empty shell expected)");

    const live = csm.rows[0];
    const empty = shell.rows[0];

    if (live.id === empty.id) throw new Error("CSM0010 and TDR-CN unexpectedly share an id");
    if (live.category !== "CONSUMABLE") {
      throw new Error(`CSM0010 category is ${live.category}, expected CONSUMABLE`);
    }

    const shellCounts = {
      InventoryLog: await countFor(client, "InventoryLog", empty.id),
      IncomingLine: await countFor(client, "IncomingLine", empty.id),
      GeneratedMovement: await countFor(client, "GeneratedMovement", empty.id),
      BundleItem: await countFor(client, "BundleItem", empty.id),
      Transfer: await countFor(client, "Transfer", empty.id),
      SyncLog: await countFor(client, "SyncLog", empty.id),
    };
    const shellTotal = Object.values(shellCounts).reduce((a, b) => a + b, 0);
    if (shellTotal > 0) {
      throw new Error(`TDR-CN is not an empty shell: ${JSON.stringify(shellCounts)}`);
    }

    const salesHits = await client.query(
      `SELECT COUNT(*)::int AS n FROM "SalesLine" WHERE "itemCode" = 'CSM0010'`
    );
    if (salesHits.rows[0].n > 0) {
      throw new Error(`CSM0010 appears on ${salesHits.rows[0].n} SalesLine(s) — aborting`);
    }

    const liveOnHand = await client.query(
      `SELECT l.name, COALESCE(SUM(il.delta), 0)::int AS on_hand
       FROM "Location" l
       LEFT JOIN "InventoryLog" il ON il."locationId" = l.id AND il."productId" = $1
       GROUP BY l.id, l.name
       ORDER BY l.name`,
      [live.id]
    );

    console.log("Before CSM0010:", {
      id: live.id,
      sku: live.sku,
      name: live.name,
      category: live.category,
      reorderPoint: live.reorderPoint,
    });
    console.log("On hand by location:", liveOnHand.rows);
    console.log("Deleting empty TDR-CN shell:", empty.id);

    await client.query('DELETE FROM "Product" WHERE id = $1', [empty.id]);

    const updated = await client.query(
      `UPDATE "Product"
       SET sku = 'TDR-CN',
           name = $2,
           category = 'GENERAL_ACCESSORY',
           "reorderPoint" = 10,
           "adminNotes" = $3,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING sku, name, category, "reorderPoint", "adminNotes"`,
      [live.id, NEW_NAME, NEW_NOTES]
    );

    await client.query("COMMIT");
    console.log("After:", updated.rows[0]);
    console.log("Done. Ledger productId unchanged; CSM0010 code retired.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
