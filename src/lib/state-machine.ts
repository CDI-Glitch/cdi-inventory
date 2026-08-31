import { prisma } from "./db";
import { VALID_TRANSITIONS, type SalesStatus } from "./constants";
import { scheduleAfterStockChange } from "./stock-side-effects";
import {
  AltGroupUnresolvedError,
  listAltGroupTasks,
  unresolvedAltGroupSummary,
} from "./alt-group-fulfillment";

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class OptimisticLockError extends Error {
  constructor() {
    super("Record has been modified by another user. Please refresh.");
    this.name = "OptimisticLockError";
  }
}

export type StockShortage = { sku: string; name: string; onHand: number; needed: number };

export class InsufficientStockError extends Error {
  shortages: StockShortage[];

  constructor(shortages: StockShortage[]) {
    const summary = shortages
      .map((s) => `${s.sku} (on hand ${s.onHand}, need ${s.needed})`)
      .join(", ");
    super(`Cannot complete: insufficient physical stock for ${summary}.`);
    this.name = "InsufficientStockError";
    this.shortages = shortages;
  }
}

/**
 * Reads current On Hand for each productId+locationId touched by `movements`
 * and returns any SKU where On Hand can't cover the reserved qty being
 * deducted. Read-only — safe to call outside a transaction for preview UI,
 * or inside one (pass `tx`) for the authoritative pre-write check.
 */
async function findStockShortages(
  client: any,
  movements: { productId: string; locationId: string; reservedQty: number }[]
): Promise<StockShortage[]> {
  const needed = new Map<string, { productId: string; locationId: string; qty: number }>();
  for (const mov of movements) {
    if (mov.reservedQty <= 0) continue;
    const key = `${mov.productId}:${mov.locationId}`;
    const entry = needed.get(key);
    if (entry) entry.qty += mov.reservedQty;
    else needed.set(key, { productId: mov.productId, locationId: mov.locationId, qty: mov.reservedQty });
  }
  if (needed.size === 0) return [];

  const productIds = [...new Set([...needed.values()].map((e) => e.productId))];
  const products: { id: string; sku: string; name: string }[] = await client.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const shortages: StockShortage[] = [];
  for (const { productId, locationId, qty } of needed.values()) {
    const onHandResult = await client.inventoryLog.aggregate({
      where: { productId, locationId },
      _sum: { delta: true },
    });
    const onHand = onHandResult._sum.delta ?? 0;
    if (onHand - qty < 0) {
      const product = productById.get(productId);
      shortages.push({
        sku: product?.sku ?? productId,
        name: product?.name ?? productId,
        onHand,
        needed: qty,
      });
    }
  }
  return shortages;
}

/**
 * Read-only preview for the sales detail page — surfaces the same shortages
 * that would block `completeStock()`, without acquiring locks or writing
 * anything. Used to pre-emptively disable the "Mark completed" button.
 */
export async function previewStockShortages(
  movements: { productId: string; locationId: string; reservedQty: number }[]
): Promise<StockShortage[]> {
  return findStockShortages(prisma, movements);
}

export function validateTransition(from: SalesStatus, to: SalesStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

export async function transitionSalesRecord(
  recordId: string,
  newStatus: SalesStatus,
  expectedVersion: number,
  userId: string,
  invoiceNo?: string
) {
  const record = await prisma.salesRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: {
      lines: true,
      movements: true,
    },
  });

  if (record.version !== expectedVersion) {
    throw new OptimisticLockError();
  }

  const currentStatus = record.status as SalesStatus;
  if (!validateTransition(currentStatus, newStatus)) {
    throw new InvalidTransitionError(currentStatus, newStatus);
  }

  if (currentStatus === "quote" && newStatus === "deposit_paid") {
    await reserveStock(record, userId);
  } else if (newStatus === "completed") {
    const summary = unresolvedAltGroupSummary(listAltGroupTasks(record.lines, record.movements));
    if (summary) {
      throw new AltGroupUnresolvedError(summary);
    }
    await completeStock(record, userId);
  } else if (newStatus === "cancelled") {
    await releaseReservations(record.id, record.recordId, userId);
  }

  // Build update payload — invoiceNo is written once when moving to deposit_paid
  const updateData: Record<string, any> = {
    status: newStatus,
    version: { increment: 1 },
  };
  if (newStatus === "deposit_paid" && invoiceNo !== undefined) {
    updateData.invoiceNo = invoiceNo.trim() || null;
  }

  const updated = await prisma.salesRecord.updateMany({
    where: { id: recordId, version: expectedVersion },
    data: updateData,
  });

  if (updated.count === 0) {
    throw new OptimisticLockError();
  }

  return prisma.salesRecord.findUniqueOrThrow({ where: { id: recordId } });
}

async function reserveStock(record: any, userId: string) {
  if (record.lines.length === 0) {
    throw new Error("Cannot reserve stock: sales record has no lines.");
  }

  // Accumulate qty per productId so duplicate SalesLines (same SKU twice, or
  // a SKU that also appears inside a bundle) become one GeneratedMovement
  // with summed qty — avoids false mismatch ⚠. Keep the sku alongside for
  // the audit log notes below.
  const qtyMap: Record<string, { qty: number; sku: string }> = {};

  for (const line of record.lines) {
    if (line.lineType === "bundle") {
      // Prefer the BOM snapshot captured when the line was saved — insulates
      // this reservation from any BundleDefinition/BundleItem edits made
      // while the record sat in Quote. Fall back to a live lookup only for
      // lines created before the snapshot field existed.
      const snapshot = line.snapshotItems as
        | {
            productId: string;
            sku: string;
            name: string;
            qty: number;
            altGroupKey?: string | null;
          }[]
        | null
        | undefined;

      if (snapshot && snapshot.length > 0) {
        for (const item of snapshot) {
          if (item.altGroupKey) continue;
          qtyMap[item.productId] = {
            qty: (qtyMap[item.productId]?.qty ?? 0) + item.qty * line.qty,
            sku: item.sku,
          };
        }
      } else {
        const bundle = await prisma.bundleDefinition.findUnique({
          where: { code: line.itemCode },
          include: { items: { include: { product: true } } },
        });
        if (!bundle) throw new Error(`Bundle not found: ${line.itemCode}`);

        for (const item of bundle.items) {
          if (item.altGroupKey) continue;
          if (!item.product.active) {
            throw new Error(`Component SKU inactive: ${item.product.sku}`);
          }
          qtyMap[item.productId] = {
            qty: (qtyMap[item.productId]?.qty ?? 0) + item.qty * line.qty,
            sku: item.product.sku,
          };
        }
      }
    } else {
      const product = await prisma.product.findUnique({
        where: { sku: line.itemCode },
      });
      if (!product) throw new Error(`SKU not found: ${line.itemCode}`);
      if (!product.active) throw new Error(`SKU inactive: ${line.itemCode}`);

      qtyMap[product.id] = {
        qty: (qtyMap[product.id]?.qty ?? 0) + line.qty,
        sku: product.sku,
      };
    }
  }

  for (const [productId, { qty: reservedQty, sku }] of Object.entries(qtyMap)) {
    await prisma.generatedMovement.create({
      data: {
        salesRecordId: record.id,
        productId,
        locationId: record.locationId,
        reservedQty,
      },
    });

    // Mirror the manual "Adjust fulfillment" audit trail (movements/route.ts)
    // so automatic reservation on deposit_paid is equally visible on
    // /audit-log — previously this path (plain SKU AND bundle) left no
    // InventoryLog trace at all.
    await prisma.inventoryLog.create({
      data: {
        productId,
        locationId: record.locationId,
        type: "reservation_adjustment",
        delta: 0,
        reference: record.recordId,
        enteredBy: userId,
        notes: `${record.recordId} reserved on deposit: ${sku} ×${reservedQty}`,
      },
    });
  }

  scheduleAfterStockChange(Object.keys(qtyMap));
}

async function completeStock(record: any, userId: string) {
  const movements = await prisma.generatedMovement.findMany({
    where: { salesRecordId: record.id, reservedQty: { gt: 0 } },
  });
  if (movements.length === 0) return;

  // Lock every distinct productId+locationId touched by this completion, in a
  // deterministic order, before re-reading On Hand. Without this, two
  // concurrent completions on the same SKU+location could both pass the
  // check and both write — this is the actual fix for the race, not just
  // the read-then-write check by itself.
  const lockKeys = [...new Set(movements.map((m) => `${m.productId}:${m.locationId}`))].sort();

  await prisma.$transaction(async (tx) => {
    for (const key of lockKeys) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    }

    const shortages = await findStockShortages(tx, movements);
    if (shortages.length > 0) {
      throw new InsufficientStockError(shortages);
    }

    for (const mov of movements) {
      await tx.inventoryLog.create({
        data: {
          productId: mov.productId,
          locationId: mov.locationId,
          type: "sales_deduction",
          delta: -mov.reservedQty,
          reference: record.recordId,
          enteredBy: userId,
          notes: `Auto: completed ${record.recordId}`,
        },
      });

      await tx.generatedMovement.update({
        where: { id: mov.id },
        data: { reservedQty: 0 },
      });
    }
  });

  scheduleAfterStockChange(movements.map((m) => m.productId));
}

async function releaseReservations(salesRecordId: string, recordId: string, userId: string) {
  const movements = await prisma.generatedMovement.findMany({
    where: { salesRecordId, reservedQty: { gt: 0 } },
    include: { product: true },
  });

  // Same rationale as reserveStock(): mirror the manual fulfillment-edit
  // audit trail so cancelling a record with active reservations is visible
  // on /audit-log instead of silently zeroing GeneratedMovement.
  for (const mov of movements) {
    await prisma.inventoryLog.create({
      data: {
        productId: mov.productId,
        locationId: mov.locationId,
        type: "reservation_adjustment",
        delta: 0,
        reference: recordId,
        enteredBy: userId,
        notes: `${recordId} reservation released on cancel: ${mov.product.sku} ×${mov.reservedQty}`,
      },
    });
  }

  await prisma.generatedMovement.updateMany({
    where: { salesRecordId, reservedQty: { gt: 0 } },
    data: { reservedQty: 0 },
  });

  scheduleAfterStockChange(movements.map((m) => m.productId));
}
