import { prisma } from "./db";
import { RESERVATION_AGING_WARNING_DAYS, RESERVATION_AGING_CRITICAL_DAYS } from "./constants";

// Same eligibility rule Forecast Mode uses on the Inventory page: containers that are
// actually on their way (not just "pending" at the supplier) and have a known ETA.
const INCOMING_ELIGIBLE_STATUSES = ["shipped", "in_transit", "arrived"];

export interface NearestIncoming {
  poRef: string;
  eta: string;
  qtyOrdered: number;
}

export interface AgingReservationRow {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  locationId: string;
  locationName: string;
  recordId: string;
  salesRecordDbId: string;
  customer: string;
  createdAt: string;
  ageDays: number;
  /** null = reservation isn't old enough to flag on age alone */
  ageSignal: "AGING" | "STALE" | null;
  reservedQty: number;
  onHand: number;
  available: number;
  /** null = this SKU/location isn't currently backordered */
  stockSignal: "BACKORDERED" | null;
  /** Internal sort/highlight only — never render as a single merged badge. */
  rank: 0 | 1 | 2;
  nearestIncoming: NearestIncoming | null;
}

/**
 * Reservations that have been sitting in deposit_paid/fully_paid too long, and/or are
 * currently backordered (Available < 0) at their location. Age and stock are reported
 * as two independent signals so the reader knows whether to chase the customer, chase
 * supply, or both. See docs/constitution.md decision log for the full rationale.
 */
export async function getAgingReservations(
  opts: { locationId?: string } = {}
): Promise<AgingReservationRow[]> {
  const movements = await prisma.generatedMovement.findMany({
    where: {
      reservedQty: { gt: 0 },
      ...(opts.locationId ? { locationId: opts.locationId } : {}),
      salesRecord: { status: { in: ["deposit_paid", "fully_paid"] } },
    },
    include: { product: true, location: true, salesRecord: true },
  });

  if (movements.length === 0) return [];

  // Batch on-hand + reserved totals for every (productId, locationId) pair we touched,
  // instead of one query per row.
  const pairs = Array.from(
    new Map(movements.map((m) => [`${m.productId}:${m.locationId}`, { productId: m.productId, locationId: m.locationId }])).values()
  );
  const productIds = Array.from(new Set(pairs.map((p) => p.productId)));
  const locationIds = Array.from(new Set(pairs.map((p) => p.locationId)));

  const [logs, allReserved] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["productId", "locationId"],
      where: { productId: { in: productIds }, locationId: { in: locationIds } },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["productId", "locationId"],
      where: { productId: { in: productIds }, locationId: { in: locationIds }, reservedQty: { gt: 0 } },
      _sum: { reservedQty: true },
    }),
  ]);

  const onHandMap = new Map(logs.map((l) => [`${l.productId}:${l.locationId}`, l._sum.delta ?? 0]));
  const reservedMap = new Map(allReserved.map((r) => [`${r.productId}:${r.locationId}`, r._sum.reservedQty ?? 0]));

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const preliminary = movements.map((m) => {
    const key = `${m.productId}:${m.locationId}`;
    const onHand = onHandMap.get(key) ?? 0;
    const reserved = reservedMap.get(key) ?? 0;
    const available = onHand - reserved;
    const ageDays = Math.floor((now - m.createdAt.getTime()) / dayMs);

    let ageSignal: AgingReservationRow["ageSignal"] = null;
    if (ageDays >= RESERVATION_AGING_CRITICAL_DAYS) ageSignal = "STALE";
    else if (ageDays >= RESERVATION_AGING_WARNING_DAYS) ageSignal = "AGING";

    const stockSignal: AgingReservationRow["stockSignal"] = available < 0 ? "BACKORDERED" : null;

    return { m, onHand, available, ageDays, ageSignal, stockSignal };
  });

  // Only surface rows that are actually worth flagging: aged enough, or already
  // backordered even if the reservation itself is brand new.
  const flagged = preliminary.filter((r) => r.ageSignal !== null || r.stockSignal !== null);
  if (flagged.length === 0) return [];

  // Nearest incoming container per (productId, locationId) — only needed for
  // backordered rows, so scope the lookup to just those pairs.
  const backorderedPairs = Array.from(
    new Map(
      flagged
        .filter((r) => r.stockSignal === "BACKORDERED")
        .map((r) => [`${r.m.productId}:${r.m.locationId}`, { productId: r.m.productId, locationId: r.m.locationId }])
    ).values()
  );

  const nearestIncomingMap = new Map<string, NearestIncoming>();
  await Promise.all(
    backorderedPairs.map(async ({ productId, locationId }) => {
      const container = await prisma.incomingShipment.findFirst({
        where: {
          locationId,
          status: { in: INCOMING_ELIGIBLE_STATUSES },
          eta: { not: null },
          lines: { some: { productId } },
        },
        orderBy: { eta: "asc" },
        include: { lines: { where: { productId } } },
      });
      if (!container || !container.eta) return;
      const qtyOrdered = container.lines.reduce((sum, l) => sum + l.qtyOrdered, 0);
      nearestIncomingMap.set(`${productId}:${locationId}`, {
        poRef: container.poRef,
        eta: container.eta.toISOString(),
        qtyOrdered,
      });
    })
  );

  const rows: AgingReservationRow[] = flagged.map((r) => {
    const key = `${r.m.productId}:${r.m.locationId}`;
    const rank: AgingReservationRow["rank"] =
      r.stockSignal === "BACKORDERED" || r.ageSignal === "STALE" ? 2 : r.ageSignal === "AGING" ? 1 : 0;

    return {
      id: r.m.id,
      productId: r.m.productId,
      sku: r.m.product.sku,
      productName: r.m.product.name,
      locationId: r.m.locationId,
      locationName: r.m.location.name,
      recordId: r.m.salesRecord.recordId,
      salesRecordDbId: r.m.salesRecordId,
      customer: r.m.salesRecord.customer,
      createdAt: r.m.createdAt.toISOString(),
      ageDays: r.ageDays,
      ageSignal: r.ageSignal,
      reservedQty: r.m.reservedQty,
      onHand: r.onHand,
      available: r.available,
      stockSignal: r.stockSignal,
      rank,
      nearestIncoming: r.stockSignal === "BACKORDERED" ? nearestIncomingMap.get(key) ?? null : null,
    };
  });

  rows.sort((a, b) => b.rank - a.rank || b.ageDays - a.ageDays);
  return rows;
}
