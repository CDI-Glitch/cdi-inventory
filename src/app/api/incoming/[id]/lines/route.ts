import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const UpdateLineSchema = z.object({
  lineId: z.string().min(1),
  qtyReceived: z.number().int().min(0),
});

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

  if (!["arrived", "in_transit"].includes(shipment.status)) {
    return NextResponse.json(
      { error: "Can only update received qty when status is in_transit or arrived" },
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
