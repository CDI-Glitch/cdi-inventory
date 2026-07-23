import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const MovementRowSchema = z.object({
  sku: z.string().min(1),
  reservedQty: z.number().int().min(0),
});

const PutMovementsSchema = z.object({
  // Full desired fulfillment list. rows with reservedQty=0 will zero-out existing movement.
  movements: z.array(MovementRowSchema).min(1, "At least one row is required"),
});

// PUT /api/sales/[id]/movements
// Replaces the fulfillment (GeneratedMovement) layer for deposit_paid/fully_paid records.
// Accessible to sales, editor, and admin. viewer is blocked.
// Back-orders are ALLOWED (Available can go negative) — consistent with constitution H#3.
// Every changed SKU writes a delta=0 reservation_adjustment InventoryLog row for full audit trail.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;

  const { id } = await params;
  const body = await req.json();
  const parsed = PutMovementsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.salesRecord.findUnique({
    where: { id },
    include: { movements: { include: { product: true } } },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const editableStatuses = ["deposit_paid", "fully_paid"];
  if (!editableStatuses.includes(record.status)) {
    return NextResponse.json(
      { error: `Fulfillment can only be adjusted on deposit_paid or fully_paid records (current: ${record.status})` },
      { status: 400 }
    );
  }

  // deposit_paid: sales/editor/admin; fully_paid: editor/admin only
  const canEdit =
    (record.status === "deposit_paid" &&
      ["admin", "editor", "sales"].includes(role)) ||
    (record.status === "fully_paid" &&
      ["admin", "editor"].includes(role));
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = (session.user as any)?.id ?? "system";
  const { movements: targetRows } = parsed.data;

  // Resolve all target SKUs → productId
  const skus = targetRows.map((r) => r.sku);
  const products = await prisma.product.findMany({
    where: { sku: { in: skus }, active: true },
    select: { id: true, sku: true, name: true },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.sku, p]));

  const missingSkus = skus.filter((s) => !productMap[s]);
  if (missingSkus.length > 0) {
    return NextResponse.json(
      { error: `SKUs not found or inactive: ${missingSkus.join(", ")}` },
      { status: 400 }
    );
  }

  // Current movements keyed by productId
  const currentByProductId = Object.fromEntries(
    record.movements.map((m) => [m.productId, m])
  );

  // Build audit log rows and movement upserts
  const auditRows: Array<{
    productId: string;
    locationId: string;
    notes: string;
    oldQty: number;
    newQty: number;
  }> = [];

  for (const row of targetRows) {
    const product = productMap[row.sku];
    const existing = currentByProductId[product.id];
    const oldQty = existing?.reservedQty ?? 0;
    const newQty = row.reservedQty;

    if (oldQty !== newQty) {
      const action =
        oldQty === 0 ? "added" : newQty === 0 ? "removed" : "changed";
      const detail =
        action === "changed"
          ? `${row.sku} ×${oldQty} → ×${newQty}`
          : action === "added"
          ? `${row.sku} ×${newQty}`
          : `${row.sku} ×${oldQty}`;

      auditRows.push({
        productId: product.id,
        locationId: record.locationId,
        notes: `${record.recordId} fulfillment ${action}: ${detail}`,
        oldQty,
        newQty,
      });
    }
  }

  // Also zero-out any existing movements whose SKU is NOT in the new list
  for (const mov of record.movements) {
    const stillPresent = targetRows.some(
      (r) => productMap[r.sku]?.id === mov.productId && r.reservedQty > 0
    );
    if (!stillPresent && mov.reservedQty > 0) {
      auditRows.push({
        productId: mov.productId,
        locationId: record.locationId,
        notes: `${record.recordId} fulfillment removed: ${mov.product.sku} ×${mov.reservedQty}`,
        oldQty: mov.reservedQty,
        newQty: 0,
      });
    }
  }

  // Execute everything in a single transaction
  await prisma.$transaction(async (tx) => {
    // Upsert / zero-out movements per target row
    for (const row of targetRows) {
      const product = productMap[row.sku];
      const existing = currentByProductId[product.id];
      if (existing) {
        await tx.generatedMovement.update({
          where: { id: existing.id },
          data: { reservedQty: row.reservedQty },
        });
      } else if (row.reservedQty > 0) {
        await tx.generatedMovement.create({
          data: {
            salesRecordId: id,
            productId: product.id,
            locationId: record.locationId,
            reservedQty: row.reservedQty,
          },
        });
      }
    }

    // Zero-out movements not in the new list
    for (const mov of record.movements) {
      const stillPresent = targetRows.some(
        (r) => productMap[r.sku]?.id === mov.productId && r.reservedQty > 0
      );
      if (!stillPresent && mov.reservedQty > 0) {
        await tx.generatedMovement.update({
          where: { id: mov.id },
          data: { reservedQty: 0 },
        });
      }
    }

    // Write delta=0 audit log rows for every changed SKU
    for (const audit of auditRows) {
      await tx.inventoryLog.create({
        data: {
          productId: audit.productId,
          locationId: audit.locationId,
          type: "reservation_adjustment",
          delta: 0,
          reference: record.recordId,
          enteredBy: userId,
          notes: audit.notes,
        },
      });
    }
  });

  const updated = await prisma.salesRecord.findUniqueOrThrow({
    where: { id },
    include: {
      location: true,
      lines: { orderBy: { sortOrder: "asc" } },
      movements: { include: { product: true, location: true }, orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json(updated);
}
