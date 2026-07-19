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
  userId: string
) {
  // Fetch record first (outside transaction — driver adapter doesn't support interactive tx)
  const record = await prisma.salesRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: { movements: true },
  });

  if (record.version !== expectedVersion) {
    throw new OptimisticLockError();
  }

  const currentStatus = record.status as SalesStatus;
  if (!validateTransition(currentStatus, newStatus)) {
    throw new InvalidTransitionError(currentStatus, newStatus);
  }

  // Build all operations to run sequentially
  if (currentStatus === "quote" && newStatus === "deposit_paid") {
    await reserveStock(record);
  } else if (newStatus === "completed") {
    await completeStock(record, userId);
  } else if (newStatus === "cancelled") {
    await releaseReservations(record.id);
  }

  // Final status update with optimistic lock check
  const updated = await prisma.salesRecord.updateMany({
    where: { id: recordId, version: expectedVersion },
    data: { status: newStatus, version: { increment: 1 } },
  });

  if (updated.count === 0) {
    throw new OptimisticLockError();
  }

  return prisma.salesRecord.findUniqueOrThrow({ where: { id: recordId } });
}

async function reserveStock(record: any) {
  if (record.saleType === "bundle") {
    const bundle = await prisma.bundleDefinition.findUnique({
      where: { code: record.itemCode },
      include: { items: { include: { product: true } } },
    });
    if (!bundle) throw new Error(`Bundle not found: ${record.itemCode}`);

    for (const item of bundle.items) {
      if (!item.product.active) {
        throw new Error(`Component SKU inactive: ${item.product.sku}`);
      }
      await prisma.generatedMovement.create({
        data: {
          salesRecordId: record.id,
          productId: item.productId,
          locationId: record.locationId,
          reservedQty: item.qty * record.qty,
        },
      });
    }
  } else {
    const product = await prisma.product.findUnique({
      where: { sku: record.itemCode },
    });
    if (!product) throw new Error(`SKU not found: ${record.itemCode}`);
    if (!product.active) throw new Error(`SKU inactive: ${record.itemCode}`);

    await prisma.generatedMovement.create({
      data: {
        salesRecordId: record.id,
        productId: product.id,
        locationId: record.locationId,
        reservedQty: record.qty,
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
