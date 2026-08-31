import { prisma } from "./db";

export interface MonthlyDepositRow {
  monthKey: string;
  monthLabel: string;
  byLocation: Record<string, number>;
  total: number;
}

/**
 * Counts sales records that reached deposit_paid, bucketed by month and
 * location. Uses GeneratedMovement.createdAt as the deposit timestamp — the
 * same proxy the Aging Reservations feature relies on, since there is no
 * dedicated depositPaidAt column (see docs/aging-reservations-runbook.md).
 *
 * A record keeps its earliest movement row even after being completed or
 * cancelled (completeStock/releaseReservations only zero reservedQty), so
 * this counts every order that ever received a deposit, regardless of its
 * current status.
 */
export async function getMonthlyDepositCounts(monthsBack = 12): Promise<{
  months: MonthlyDepositRow[];
  locations: { id: string; name: string }[];
}> {
  const locations = await prisma.location.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const earliest = await prisma.generatedMovement.groupBy({
    by: ["salesRecordId"],
    _min: { createdAt: true },
  });

  const recordIds = earliest.map((e) => e.salesRecordId);
  const records = recordIds.length
    ? await prisma.salesRecord.findMany({
        where: { id: { in: recordIds } },
        select: { id: true, locationId: true },
      })
    : [];
  const locationByRecord = new Map(records.map((r) => [r.id, r.locationId]));

  const cutoff = new Date();
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - (monthsBack - 1));

  const buckets = new Map<string, Record<string, number>>();
  for (const e of earliest) {
    const depositAt = e._min.createdAt;
    if (!depositAt || depositAt < cutoff) continue;
    const locationId = locationByRecord.get(e.salesRecordId);
    if (!locationId) continue;

    const monthKey = `${depositAt.getFullYear()}-${String(depositAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(monthKey) ?? {};
    bucket[locationId] = (bucket[locationId] ?? 0) + 1;
    buckets.set(monthKey, bucket);
  }

  const months: MonthlyDepositRow[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < monthsBack; i++) {
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const byLocation = buckets.get(monthKey) ?? {};
    const total = Object.values(byLocation).reduce((a, b) => a + b, 0);
    months.push({
      monthKey,
      monthLabel: cursor.toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
      byLocation,
      total,
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return { months, locations };
}
