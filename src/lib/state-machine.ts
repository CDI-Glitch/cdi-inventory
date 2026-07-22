import { prisma } from "./db";
import { VALID_TRANSITIONS, type SalesStatus } from "./constants";

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
    await reserveStock(record);
  } else if (newStatus === "completed") {
    await completeStock(record, userId);
  } else if (newStatus === "cancelled") {
    await releaseReservations(record.id);
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

async function reserveStock(record: any) {
  if (record.lines.length === 0) {
    throw new Error("Cannot reserve stock: sales record has no lines.");
  }

  // Accumulate qty per productId so duplicate SalesLines (same SKU twice)
  // become one GeneratedMovement with summed qty — avoids false mismatch ⚠
  const qtyMap: Record<string, number> = {};

  for (const line of record.lines) {
    if (line.lineType === "bundle") {
      const bundle = await prisma.bundleDefinition.findUnique({
        where: { code: line.itemCode },
        include: { items: { include: { product: true } } },
      });
      if (!bundle) throw new Error(`Bundle not found: ${line.itemCode}`);

      for (const item of bundle.items) {
        if (!item.product.active) {
          throw new Error(`Component SKU inactive: ${item.product.sku}`);
        }
        qtyMap[item.productId] = (qtyMap[item.productId] ?? 0) + item.qty * line.qty;
      }
    } else {
      const product = await prisma.product.findUnique({
        where: { sku: line.itemCode },
      });
      if (!product) throw new Error(`SKU not found: ${line.itemCode}`);
      if (!product.active) throw new Error(`SKU inactive: ${line.itemCode}`);

      qtyMap[product.id] = (qtyMap[product.id] ?? 0) + line.qty;
    }
  }

  for (const [productId, reservedQty] of Object.entries(qtyMap)) {
    await prisma.generatedMovement.create({
      data: {
        salesRecordId: record.id,
        productId,
        locationId: record.locationId,
        reservedQty,
      },
    });
  }
}

async function completeStock(record: any, userId: string) {
  const movements = await prisma.generatedMovement.findMany({
    where: { salesRecordId: record.id, reservedQty: { gt: 0 } },
  });

  for (const mov of movements) {
    await prisma.inventoryLog.create({
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

    await prisma.generatedMovement.update({
      where: { id: mov.id },
      data: { reservedQty: 0 },
    });
  }
}

async function releaseReservations(salesRecordId: string) {
  await prisma.generatedMovement.updateMany({
    where: { salesRecordId, reservedQty: { gt: 0 } },
    data: { reservedQty: 0 },
  });
}
