/**
 * One-off correction: SR-0043 (AEM NT Pty Ltd, INV-000040, 4x CD-2D-17158)
 * was marked `completed` on 2026-08-14 before the goods were actually
 * shipped — the customer paid in full and is waiting on an incoming
 * container, so the record should have stayed at `fully_paid` with an
 * active reservation. `completed` is a terminal state in the normal state
 * machine (no outgoing transition), so this reverts it directly:
 *
 *  1. SalesRecord.status: completed -> fully_paid (+version bump)
 *  2. GeneratedMovement.reservedQty: 0 -> 4 (restores the reservation so
 *     Available = OnHand - Reserved correctly shows -4, re-flagging this
 *     as a pending/backordered order until the container is received and
 *     someone properly clicks "Mark completed").
 *
 * Does NOT touch the existing sales_deduction(-4) or stocktake_correction(+4)
 * InventoryLog rows from 2026-08-25 — On Hand net stays at 0, which is the
 * true physical count right now. Only the Reserved side is restored.
 *
 * Run: npx tsx scripts/revert-sr0043-premature-complete.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

const RECORD_ID = "SR-0043";
const USER_TAG = "admin-correction-2026-08-25";

async function main() {
  const record = await prisma.salesRecord.findFirst({
    where: { recordId: RECORD_ID },
    include: { movements: { include: { product: true } } },
  });
  if (!record) throw new Error(`${RECORD_ID} not found`);

  if (record.status !== "completed") {
    console.log(`SKIP: ${RECORD_ID} status is "${record.status}", not "completed" — nothing to revert.`);
    return;
  }

  const movement = record.movements.find((m: any) => m.product.sku === "CD-2D-17158");
  if (!movement) throw new Error("Expected movement for CD-2D-17158 not found");

  await prisma.$transaction(async (tx) => {
    await tx.generatedMovement.update({
      where: { id: movement.id },
      data: { reservedQty: 4 },
    });

    await tx.inventoryLog.create({
      data: {
        productId: movement.productId,
        locationId: movement.locationId,
        type: "reservation_adjustment",
        delta: 0,
        reference: RECORD_ID,
        enteredBy: USER_TAG,
        notes: `${RECORD_ID} reverted from premature completed -> fully_paid (2026-08-25): goods not actually shipped, customer awaiting incoming container. Reservation restored ×4.`,
      },
    });

    await tx.salesRecord.update({
      where: { id: record.id },
      data: { status: "fully_paid", version: { increment: 1 } },
    });
  });

  console.log(`REVERTED: ${RECORD_ID} completed -> fully_paid, reservedQty restored to 4 on CD-2D-17158.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
