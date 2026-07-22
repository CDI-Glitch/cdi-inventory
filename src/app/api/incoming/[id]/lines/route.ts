import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const UpdateLineSchema = z.object({
  lineId: z.string().min(1),
  qtyReceived: z.number().int().min(0),
});

const ReplaceLineSchema = z.object({
  productId: z.string().min(1),
  qtyOrdered: z.number().int().min(1),
  unitCost: z.number().positive().optional(),
  notes: z.string().optional(),
});

const ReplaceLinesSchema = z.object({
  lines: z.array(ReplaceLineSchema).min(1, "At least one line is required"),
});

/**
 * PUT — replace all lines atomically.
 * Only allowed when status is pending, shipped, or in_transit.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: shipmentId } = await params;

  const shipment = await prisma.incomingShipment.findUnique({
    where: { id: shipmentId },
  });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const editableStatuses = ["pending", "shipped", "in_transit"];
  if (!editableStatuses.includes(shipment.status)) {
    return NextResponse.json(
      { error: `Lines can only be edited when status is pending, shipped, or in_transit (current: ${shipment.status})` },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = ReplaceLinesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lines } = parsed.data;

  // Verify all productIds exist
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const existingProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
    select: { id: true },
  });
  const validIds = new Set(existingProducts.map((p) => p.id));
  const invalidIds = productIds.filter((id) => !validIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `Unknown or inactive product IDs: ${invalidIds.join(", ")}` },
      { status: 400 }
    );
  }

  // Atomically replace all lines
  await prisma.$transaction([
    prisma.incomingLine.deleteMany({ where: { shipmentId } }),
    prisma.incomingLine.createMany({
      data: lines.map((l) => ({
        shipmentId,
        productId: l.productId,
        qtyOrdered: l.qtyOrdered,
        qtyReceived: 0,
        unitCost: l.unitCost ?? null,
        notes: l.notes ?? null,
      })),
    }),
  ]);

  const updated = await prisma.incomingShipment.findUnique({
    where: { id: shipmentId },
    include: {
      location: true,
      lines: { include: { product: true }, orderBy: { id: "asc" } },
    },
  });

  return NextResponse.json(updated);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: shipmentId } = await params;

  // Verify shipment exists and is in arrived state
  const shipment = await prisma.incomingShipment.findUniqueOrThrow({
    where: { id: shipmentId },
  });

  if (shipment.status !== "arrived") {
    return NextResponse.json(
      { error: "Can only update received qty when status is arrived" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = UpdateLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lineId, qtyReceived } = parsed.data;

  const line = await prisma.incomingLine.findUniqueOrThrow({
    where: { id: lineId },
  });

  if (line.shipmentId !== shipmentId) {
    return NextResponse.json({ error: "Line does not belong to this shipment" }, { status: 400 });
  }

  const updatedLine = await prisma.incomingLine.update({
    where: { id: lineId },
    data: { qtyReceived },
    include: { product: true },
  });

  return NextResponse.json(updatedLine);
}
