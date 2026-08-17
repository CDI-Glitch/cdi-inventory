import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { scheduleAfterStockChange } from "@/lib/stock-side-effects";
import { canEditFulfillment, roleFromSession } from "@/lib/permissions";
import { applyAltGroupPick } from "@/lib/alt-group-fulfillment";

const BodySchema = z.object({
  lineId: z.string().min(1),
  altGroupKey: z.string().min(1),
  productId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = roleFromSession(session);

  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.salesRecord.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      movements: true,
    },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditFulfillment(role, record.status)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applied = applyAltGroupPick(
    record.lines,
    record.movements,
    parsed.data.lineId,
    parsed.data.altGroupKey,
    parsed.data.productId
  );
  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: 400 });
  }

  const current = new Map<string, number>();
  for (const mov of record.movements) {
    current.set(mov.productId, (current.get(mov.productId) ?? 0) + mov.reservedQty);
  }

  const changedIds: string[] = [];
  for (const [productId, nextQty] of applied.nextReserved) {
    const oldQty = current.get(productId) ?? 0;
    const clamped = Math.max(0, nextQty);
    if (oldQty !== clamped) changedIds.push(productId);
  }
  for (const [productId, oldQty] of current) {
    if (!applied.nextReserved.has(productId) && oldQty > 0) {
      applied.nextReserved.set(productId, 0);
      if (!changedIds.includes(productId)) changedIds.push(productId);
    }
  }

  if (changedIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: changedIds } },
    select: { id: true, sku: true },
  });
  const skuById = Object.fromEntries(products.map((p) => [p.id, p.sku]));
  const userId = (session.user as any)?.id ?? "system";

  await prisma.$transaction(async (tx) => {
    for (const productId of changedIds) {
      const newQty = Math.max(0, applied.nextReserved.get(productId) ?? 0);
      const existing = record.movements.filter((m) => m.productId === productId);
      const primary = existing[0];
      const oldQty = existing.reduce((sum, m) => sum + m.reservedQty, 0);

      if (primary) {
        await tx.generatedMovement.update({
          where: { id: primary.id },
          data: { reservedQty: newQty },
        });
        for (const extra of existing.slice(1)) {
          if (extra.reservedQty !== 0) {
            await tx.generatedMovement.update({
              where: { id: extra.id },
              data: { reservedQty: 0 },
            });
          }
        }
      } else if (newQty > 0) {
        await tx.generatedMovement.create({
          data: {
            salesRecordId: id,
            productId,
            locationId: record.locationId,
            reservedQty: newQty,
          },
        });
      }

      const sku = skuById[productId] ?? productId;
      const action = oldQty === 0 ? "added" : newQty === 0 ? "removed" : "changed";
      const detail =
        action === "changed" ? `${sku} ×${oldQty} → ×${newQty}` : `${sku} ×${Math.max(oldQty, newQty)}`;
      await tx.inventoryLog.create({
        data: {
          productId,
          locationId: record.locationId,
          type: "reservation_adjustment",
          delta: 0,
          reference: record.recordId,
          enteredBy: userId,
          notes: `${record.recordId} alt-group pick ${action}: ${detail}`,
        },
      });
    }
  });

  scheduleAfterStockChange(changedIds);
  return NextResponse.json({ ok: true });
}
