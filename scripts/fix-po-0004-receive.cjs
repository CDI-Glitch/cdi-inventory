/**
 * PO-0004 receive correction (Sydney / 洛克斯).
 *
 * Default: remaining lines Received = current Ordered, then backfill receive_stock
 * only when no matching PO-0004 receive_stock already exists.
 *
 * Known factory variances (do not change Ordered to hide them):
 *   TT-BSG-89-SHB     Ordered 8  Received 10
 *   CD-MG-HR-SHB      Ordered 4  Received 3   (do not record the extra same-side pair)
 *   LC-2D-181610-ST   Ordered 1  Received 0   (BST arrived instead → adjustment_in)
 *
 * Usage:
 *   node scripts/fix-po-0004-receive.cjs          # dry-run, no writes
 *   node scripts/fix-po-0004-receive.cjs --apply  # BEGIN / COMMIT
 *
 * Never DELETE or UPDATE InventoryLog. Reverse only with a new opposite-delta row.
 * Idempotent: re-run after adding more EXCEPTIONS skips already-correct rows.
 */

const { Pool } = require("pg");
require("dotenv").config({ path: ".env" });

const APPLY = process.argv.includes("--apply");
const PO_REF = "PO-0004";
const ENTERED_BY = "system";

const EXCEPTIONS = {
  "TT-BSG-89-SHB": {
    qtyOrdered: 8,
    qtyReceived: 10,
    notes: "Factory over-ship: ordered 8, received 10",
  },
  "CD-MG-HR-SHB": {
    qtyOrdered: 4,
    qtyReceived: 3,
    notes: "Factory short-ship: ordered 4, received 3",
  },
  "LC-2D-181610-ST": {
    qtyOrdered: 1,
    qtyReceived: 0,
    notes: "Factory substitution: received LC-2D-181610-BST instead",
    restoreSku: "LC-2D-181610-ST",
    maybeCurrentSku: "LC-2D-181610-BST",
  },
};

const SUBSTITUTION = {
  orderedSku: "LC-2D-181610-ST",
  receivedSku: "LC-2D-181610-BST",
  qty: 1,
  notes: "PO-0004 correction: ordered LC-2D-181610-ST, received LC-2D-181610-BST instead",
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});

function pad(s, n) {
  return String(s).padEnd(n);
}

async function requireSku(client, sku) {
  const exact = await client.query(
    `SELECT id, sku, name FROM "Product" WHERE sku = $1`,
    [sku]
  );
  if (exact.rows.length === 1) return exact.rows[0];

  const like = await client.query(
    `SELECT sku, name FROM "Product" WHERE sku ILIKE $1 ORDER BY sku LIMIT 10`,
    [`%${sku.replace(/-/g, "")}%`]
  );
  console.error(`ABORT: exact SKU not found: ${sku}`);
  if (like.rows.length) {
    console.error("Candidates:");
    for (const r of like.rows) console.error(`  ${r.sku}  ${r.name}`);
  }
  throw new Error(`SKU not found: ${sku}`);
}

function receiveLogsFor(logs, productId) {
  return logs.filter((l) => l.productId === productId && l.type === "receive_stock");
}

function sumDelta(rows) {
  return rows.reduce((s, r) => s + r.delta, 0);
}

async function main() {
  const client = await pool.connect();
  try {
    console.log(APPLY ? "MODE: --apply (will write)" : "MODE: dry-run (no writes)");

    const shipmentRes = await client.query(
      `SELECT s.id, s."locationId", s."poRef", s.status, l.name AS "locationName"
       FROM "IncomingShipment" s
       JOIN "Location" l ON l.id = s."locationId"
       WHERE s."poRef" = $1`,
      [PO_REF]
    );
    if (shipmentRes.rows.length === 0) throw new Error(`${PO_REF} not found`);
    const shipment = shipmentRes.rows[0];
    console.log(
      `Found: ${shipment.poRef} | status: ${shipment.status} | loc: ${shipment.locationName}`
    );
    if (shipment.status !== "confirmed") {
      throw new Error(`Unexpected status: ${shipment.status}. This script is only for confirmed shipments.`);
    }

    const st = await requireSku(client, SUBSTITUTION.orderedSku);
    const bst = await requireSku(client, SUBSTITUTION.receivedSku);
    for (const sku of Object.keys(EXCEPTIONS)) {
      await requireSku(client, sku);
    }

    const linesRes = await client.query(
      `SELECT il.id, il."productId", il."qtyOrdered", il."qtyReceived", il.notes, p.sku, p.name
       FROM "IncomingLine" il
       JOIN "Product" p ON p.id = il."productId"
       WHERE il."shipmentId" = $1
       ORDER BY p.sku`,
      [shipment.id]
    );
    const lines = linesRes.rows;
    console.log(`\nCurrent lines (${lines.length}):`);
    console.log(`${pad("SKU", 28)} ${pad("Ord", 5)} ${pad("Rcv", 5)} Name`);
    for (const line of lines) {
      console.log(`${pad(line.sku, 28)} ${pad(line.qtyOrdered, 5)} ${pad(line.qtyReceived, 5)} ${line.name}`);
    }

    const logsRes = await client.query(
      `SELECT il.id, il."productId", il.type, il.delta, il.notes, p.sku
       FROM "InventoryLog" il
       JOIN "Product" p ON p.id = il."productId"
       WHERE il.reference = $1
       ORDER BY il."createdAt"`,
      [PO_REF]
    );
    const logs = logsRes.rows;
    console.log(`\nExisting InventoryLog for ${PO_REF}: ${logs.length}`);
    for (const log of logs) {
      console.log(`  ${pad(log.type, 22)} ${pad(log.sku, 28)} delta=${log.delta}  ${log.notes ?? ""}`);
    }

    const stLine = lines.find((l) => l.sku === SUBSTITUTION.orderedSku);
    const bstLine = lines.find((l) => l.sku === SUBSTITUTION.receivedSku);
    if (stLine && bstLine) {
      throw new Error("Both ST and BST lines exist on the shipment — resolve by hand, do not guess.");
    }

    const planned = [];
    const abortMismatches = [];

    for (const line of lines) {
      const ex = EXCEPTIONS[line.sku];
      const isBstStandIn = line.sku === SUBSTITUTION.receivedSku && !stLine;

      let targetSku = line.sku;
      let targetProductId = line.productId;
      let qtyOrdered = line.qtyOrdered;
      let qtyReceived = line.qtyReceived;
      let notes = line.notes;

      if (isBstStandIn) {
        targetSku = st.sku;
        targetProductId = st.id;
        qtyOrdered = EXCEPTIONS[SUBSTITUTION.orderedSku].qtyOrdered;
        qtyReceived = EXCEPTIONS[SUBSTITUTION.orderedSku].qtyReceived;
        notes = EXCEPTIONS[SUBSTITUTION.orderedSku].notes;
      } else if (ex) {
        qtyOrdered = ex.qtyOrdered;
        qtyReceived = ex.qtyReceived;
        notes = ex.notes;
      } else {
        qtyReceived = line.qtyOrdered;
      }

      // Substitution stand-in: BST stock is handled below, not as a receive on this line.
      const existingReceive = isBstStandIn
        ? []
        : receiveLogsFor(logs, line.productId);
      const existingSum = sumDelta(existingReceive);

      const lineChange =
        line.productId !== targetProductId ||
        line.qtyOrdered !== qtyOrdered ||
        line.qtyReceived !== qtyReceived ||
        (notes ?? "") !== (line.notes ?? "");

      let stockAction = "none";
      if (isBstStandIn) {
        stockAction = "none_substitution";
      } else if (qtyReceived > 0) {
        if (existingReceive.length === 0) {
          stockAction = "insert_receive";
        } else if (existingSum === qtyReceived) {
          stockAction = "skip_stock_already_ok";
        } else {
          stockAction = "abort_delta_mismatch";
          abortMismatches.push({
            sku: line.sku,
            existingSum,
            targetReceived: qtyReceived,
          });
        }
      } else if (existingReceive.length > 0 && existingSum !== 0) {
        stockAction = "abort_delta_mismatch";
        abortMismatches.push({
          sku: line.sku,
          existingSum,
          targetReceived: qtyReceived,
        });
      }

      planned.push({
        line,
        targetSku,
        targetProductId,
        qtyOrdered,
        qtyReceived,
        notes,
        lineChange,
        stockAction,
        existingSum,
      });
    }

    const existingBstReceive = receiveLogsFor(logs, bst.id);
    const bstReceiveSum = sumDelta(existingBstReceive);
    const existingBstAdj = logs.filter(
      (l) => l.productId === bst.id && l.type === "adjustment_in" && l.notes === SUBSTITUTION.notes
    );

    let bstPlan = "none";
    if (existingBstAdj.length > 0) {
      bstPlan = "skip_adjustment_already_ok";
    } else if (bstReceiveSum === SUBSTITUTION.qty && !stLine && bstLine) {
      bstPlan = "reverse_receive_then_adjustment_in";
    } else if (bstReceiveSum === 0) {
      bstPlan = "adjustment_in";
    } else if (bstReceiveSum === SUBSTITUTION.qty && stLine) {
      bstPlan = "abort_unexpected_bst_receive";
      abortMismatches.push({
        sku: bst.sku,
        existingSum: bstReceiveSum,
        targetReceived: "substitution adjustment_in only",
      });
    } else {
      bstPlan = "abort_unexpected_bst_receive";
      abortMismatches.push({
        sku: bst.sku,
        existingSum: bstReceiveSum,
        targetReceived: SUBSTITUTION.qty,
      });
    }

    console.log("\n--- Planned line actions ---");
    for (const p of planned) {
      console.log(
        `${pad(p.line.sku, 28)} → ${p.targetSku}  ord ${p.line.qtyOrdered}→${p.qtyOrdered}  rcv ${p.line.qtyReceived}→${p.qtyReceived}  line=${p.lineChange ? "UPDATE" : "ok"}  stock=${p.stockAction} (existing receive Δ=${p.existingSum})`
      );
    }
    console.log(`\nBST substitution plan: ${bstPlan}`);

    if (abortMismatches.length > 0) {
      console.error("\nABORT: existing receive_stock delta does not match target. Do not apply.");
      for (const m of abortMismatches) {
        console.error(`  ${m.sku}: existing Δ=${m.existingSum}  target=${m.targetReceived}`);
      }
      return;
    }

    if (!APPLY) {
      console.log("\nDry-run only. Re-run with --apply after you confirm the table.");
      return;
    }

    await client.query("BEGIN");
    try {
      for (const p of planned) {
        if (p.lineChange) {
          await client.query(
            `UPDATE "IncomingLine"
             SET "productId" = $1, "qtyOrdered" = $2, "qtyReceived" = $3, notes = $4
             WHERE id = $5`,
            [p.targetProductId, p.qtyOrdered, p.qtyReceived, p.notes, p.line.id]
          );
          console.log(`  LINE UPDATE ${p.line.sku} → ${p.targetSku} ord=${p.qtyOrdered} rcv=${p.qtyReceived}`);
        }

        if (p.stockAction === "insert_receive") {
          const ins = await client.query(
            `INSERT INTO "InventoryLog"
               (id, "productId", "locationId", type, delta, reference, "enteredBy", notes, "createdAt")
             VALUES (gen_random_uuid(), $1, $2, 'receive_stock', $3, $4, $5, $6, NOW())
             RETURNING id`,
            [
              p.targetProductId,
              shipment.locationId,
              p.qtyReceived,
              PO_REF,
              ENTERED_BY,
              `${PO_REF} confirmed (retroactive receive)`,
            ]
          );
          console.log(`  LOG receive_stock ${p.targetSku} +${p.qtyReceived}  ${ins.rows[0].id}`);
        }
      }

      if (bstPlan === "reverse_receive_then_adjustment_in") {
        const rev = await client.query(
          `INSERT INTO "InventoryLog"
             (id, "productId", "locationId", type, delta, reference, "enteredBy", notes, "createdAt")
           VALUES (gen_random_uuid(), $1, $2, 'adjustment_out', $3, $4, $5, $6, NOW())
           RETURNING id`,
          [
            bst.id,
            shipment.locationId,
            -bstReceiveSum,
            PO_REF,
            ENTERED_BY,
            `${PO_REF} reverse mis-attributed receive_stock on ${bst.sku} (was incoming line, should be substitution)`,
          ]
        );
        console.log(`  LOG adjustment_out ${bst.sku} ${-bstReceiveSum}  ${rev.rows[0].id}`);
      }

      if (bstPlan === "adjustment_in" || bstPlan === "reverse_receive_then_adjustment_in") {
        const adj = await client.query(
          `INSERT INTO "InventoryLog"
             (id, "productId", "locationId", type, delta, reference, "enteredBy", notes, "createdAt")
           VALUES (gen_random_uuid(), $1, $2, 'adjustment_in', $3, $4, $5, $6, NOW())
           RETURNING id`,
          [
            bst.id,
            shipment.locationId,
            SUBSTITUTION.qty,
            PO_REF,
            ENTERED_BY,
            SUBSTITUTION.notes,
          ]
        );
        console.log(`  LOG adjustment_in ${bst.sku} +${SUBSTITUTION.qty}  ${adj.rows[0].id}`);
      }

      await client.query("COMMIT");
      console.log("\nCOMMIT ok");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
