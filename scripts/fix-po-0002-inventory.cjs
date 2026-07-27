/**
 * Emergency fix: PO-0002 was confirmed with all qtyReceived = 0.
 * This script creates InventoryLog entries (receive_stock) using qtyOrdered
 * and back-fills qtyReceived on each IncomingLine.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // 1. Find PO-0002
    const shipmentRes = await client.query(
      `SELECT id, "locationId", "poRef", status FROM "IncomingShipment" WHERE "poRef" = 'PO-0002'`
    );
    if (shipmentRes.rows.length === 0) {
      console.error('PO-0002 not found');
      return;
    }
    const shipment = shipmentRes.rows[0];
    console.log(`Found: ${shipment.poRef} | status: ${shipment.status} | locationId: ${shipment.locationId}`);

    if (shipment.status !== 'confirmed') {
      console.error(`Unexpected status: ${shipment.status}. This script is only for confirmed shipments.`);
      return;
    }

    // 2. Get all lines
    const linesRes = await client.query(
      `SELECT il.id, il."productId", il."qtyOrdered", il."qtyReceived", p.sku
       FROM "IncomingLine" il
       JOIN "Product" p ON p.id = il."productId"
       WHERE il."shipmentId" = $1
       ORDER BY il.id`,
      [shipment.id]
    );

    console.log(`\nLines (${linesRes.rows.length}):`);
    for (const line of linesRes.rows) {
      console.log(`  ${line.sku.padEnd(28)} ordered=${line.qtyOrdered}  received=${line.qtyReceived}`);
    }

    // Check if already fixed
    const alreadyFixed = linesRes.rows.every(l => l.qtyReceived > 0);
    if (alreadyFixed) {
      console.log('\nAll lines already have qtyReceived > 0. Checking InventoryLog...');
    }

    // 3. Check existing InventoryLog for this PO to avoid duplicates
    const existingLogs = await client.query(
      `SELECT "productId", delta FROM "InventoryLog"
       WHERE reference = 'PO-0002' AND type = 'receive_stock'`
    );
    const alreadyLogged = new Set(existingLogs.rows.map(r => r.productId));
    console.log(`\nExisting InventoryLog entries for PO-0002: ${existingLogs.rows.length}`);

    // 4. Create InventoryLog + update qtyReceived
    let created = 0;
    let skipped = 0;

    await client.query('BEGIN');
    try {
      for (const line of linesRes.rows) {
        if (line.qtyOrdered <= 0) {
          console.log(`  SKIP (qtyOrdered=0): ${line.sku}`);
          skipped++;
          continue;
        }

        if (alreadyLogged.has(line.productId)) {
          console.log(`  SKIP (already logged): ${line.sku}`);
          skipped++;
          continue;
        }

        // Create InventoryLog
        await client.query(
          `INSERT INTO "InventoryLog" (id, "productId", "locationId", type, delta, reference, "enteredBy", notes, "createdAt")
           VALUES (gen_random_uuid(), $1, $2, 'receive_stock', $3, 'PO-0002', 'system', 'PO-0002 confirmed (retroactive fix)', NOW())`,
          [line.productId, shipment.locationId, line.qtyOrdered]
        );

        // Update qtyReceived
        await client.query(
          `UPDATE "IncomingLine" SET "qtyReceived" = $1 WHERE id = $2`,
          [line.qtyOrdered, line.id]
        );

        console.log(`  CREATED: ${line.sku.padEnd(28)} delta=+${line.qtyOrdered}`);
        created++;
      }

      await client.query('COMMIT');
      console.log(`\nDone. Created: ${created}  Skipped: ${skipped}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // 5. Verify
    console.log('\n--- Verification ---');
    const verifyRes = await client.query(
      `SELECT p.sku, SUM(CASE WHEN il."locationId" = $1 THEN il.delta ELSE 0 END) as on_hand
       FROM "InventoryLog" il
       JOIN "Product" p ON p.id = il."productId"
       WHERE il.reference = 'PO-0002'
       GROUP BY p.sku ORDER BY p.sku`,
      [shipment.locationId]
    );
    console.log('InventoryLog entries for PO-0002:');
    for (const row of verifyRes.rows) {
      console.log(`  ${row.sku.padEnd(28)} +${row.on_hand}`);
    }

  } finally {
    client.release();
  }
}

main().catch(console.error).finally(() => pool.end());
