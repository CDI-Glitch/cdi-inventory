import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { INCOMING_TRANSITIONS, type IncomingStatus } from "@/lib/constants";

const TransitionSchema = z.object({
  status: z.enum(["pending", "shipped", "in_transit", "arrived", "confirmed"]),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const shipment = await prisma.incomingShipment.findUnique({
    where: { id },
    include: {
      location: true,
      lines: { include: { product: true }, orderBy: { id: "asc" } },
    },
  });

  if (!shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(shipment);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = TransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { status: newStatus } = parsed.data;

  const shipment = await prisma.incomingShipment.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });

  const currentStatus = shipment.status as IncomingStatus;
  const allowed = INCOMING_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(newStatus as IncomingStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from "${currentStatus}" to "${newStatus}"` },
      { status: 400 }
    );
  }

  // When confirmed: create InventoryLog entries for each line
  if (newStatus === "confirmed") {
    const userId = (session.user as any)?.id ?? "system";
    for (const line of shipment.lines) {
      if (line.qtyReceived <= 0) continue;
      await prisma.inventoryLog.create({
        data: {
          productId: line.productId,
          locationId: shipment.locationId,
          type: "receive_stock",
          delta: line.qtyReceived,
          reference: shipment.poRef,
          enteredBy: userId,
          notes: `Incoming: ${shipment.poRef} confirmed`,
        },
      });
    }
  }

  const updated = await prisma.incomingShipment.update({
    where: { id },
    data: { status: newStatus },
    include: {
      location: true,
      lines: { include: { product: true }, orderBy: { id: "asc" } },
    },
  });

  return NextResponse.json(updated);
}
