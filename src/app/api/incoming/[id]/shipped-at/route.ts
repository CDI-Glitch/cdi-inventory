import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const ShippedAtSchema = z.object({
  shippedAt: z.string().min(1, "Shipped date is required"),
});

function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "not set";
}

// Admin-only correction path for the "actual" shipped date. Unlike the eta endpoint,
// this has no status restriction — it exists specifically to fix mis-entered dates
// after the fact. Because shippedAt is a shipment-level fact (not tied to one SKU) but
// InventoryLog requires a non-null productId, we write one delta:0 audit entry per
// distinct product on the shipment — same pattern already used by reserveStock /
// releaseReservations in state-machine.ts for non-stock-affecting audit trails.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = ShippedAtSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const shipment = await prisma.incomingShipment.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });

  const oldValue = formatDate(shipment.shippedAt);
  const newDate = new Date(parsed.data.shippedAt);
  const newValue = formatDate(newDate);
  const adminUserId = (session.user as any)?.id ?? "system";

  const distinctProductIds = [...new Set(shipment.lines.map((l) => l.productId))];

  await prisma.$transaction([
    prisma.incomingShipment.update({
      where: { id },
      data: { shippedAt: newDate },
    }),
    ...distinctProductIds.map((productId) =>
      prisma.inventoryLog.create({
        data: {
          productId,
          locationId: shipment.locationId,
          type: "shipped_at_correction",
          delta: 0,
          reference: shipment.poRef,
          enteredBy: adminUserId,
          notes: `${shipment.poRef} shipped date corrected: ${oldValue} → ${newValue}`,
        },
      })
    ),
  ]);

  const updated = await prisma.incomingShipment.findUniqueOrThrow({
    where: { id },
    include: {
      location: true,
      lines: { include: { product: true }, orderBy: { id: "asc" } },
    },
  });

  return NextResponse.json(updated);
}
