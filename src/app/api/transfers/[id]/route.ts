import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { TRANSFER_TRANSITIONS, type TransferStatus } from "@/lib/constants";

const TransitionSchema = z.object({
  status: z.enum(["in_transit", "completed", "cancelled"]),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: { fromLocation: true, toLocation: true, product: true },
  });

  if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(transfer);
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
  const userId = (session.user as any)?.id ?? "system";

  const transfer = await prisma.transfer.findUniqueOrThrow({ where: { id } });
  const currentStatus = transfer.status as TransferStatus;
  const allowed = TRANSFER_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(newStatus as TransferStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from "${currentStatus}" to "${newStatus}"` },
      { status: 400 }
    );
  }

  if (newStatus === "completed") {
    // Deduct from source, add to destination
    const ref = `XFER-${transfer.id.slice(-8).toUpperCase()}`;
    await prisma.inventoryLog.create({
      data: {
        productId: transfer.productId,
        locationId: transfer.fromLocationId,
        type: "transfer_out",
        delta: -transfer.qty,
        reference: ref,
        enteredBy: userId,
        notes: `Transfer to ${transfer.toLocationId}`,
      },
    });
    await prisma.inventoryLog.create({
      data: {
        productId: transfer.productId,
        locationId: transfer.toLocationId,
        type: "transfer_in",
        delta: transfer.qty,
        reference: ref,
        enteredBy: userId,
        notes: `Transfer from ${transfer.fromLocationId}`,
      },
    });
  }

  const updated = await prisma.transfer.update({
    where: { id },
    data: {
      status: newStatus,
      ...(newStatus === "completed" ? { completedAt: new Date() } : {}),
    },
    include: { fromLocation: true, toLocation: true, product: true },
  });

  return NextResponse.json(updated);
}
