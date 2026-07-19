import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const CreateTransferSchema = z.object({
  fromLocationId: z.string().min(1),
  toLocationId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.number().int().min(1),
  notes: z.string().optional(),
}).refine((d) => d.fromLocationId !== d.toLocationId, {
  message: "Source and destination locations must be different",
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const locationId = searchParams.get("locationId");

  const transfers = await prisma.transfer.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(locationId
        ? { OR: [{ fromLocationId: locationId }, { toLocationId: locationId }] }
        : {}),
    },
    include: {
      fromLocation: true,
      toLocation: true,
      product: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(transfers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = CreateTransferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { fromLocationId, toLocationId, productId, qty, notes } = parsed.data;
  const userId = (session.user as any)?.id ?? "system";

  // Verify product exists
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Check available stock at source
  const [onHandResult, reservedResult] = await Promise.all([
    prisma.inventoryLog.aggregate({
      where: { productId, locationId: fromLocationId },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.aggregate({
      where: { productId, locationId: fromLocationId, reservedQty: { gt: 0 } },
      _sum: { reservedQty: true },
    }),
  ]);

  const onHand = onHandResult._sum.delta ?? 0;
  const reserved = reservedResult._sum.reservedQty ?? 0;
  const available = onHand - reserved;

  if (available < qty) {
    return NextResponse.json(
      { error: `Insufficient available stock. Available: ${available}, Requested: ${qty}` },
      { status: 400 }
    );
  }

  const transfer = await prisma.transfer.create({
    data: {
      fromLocationId,
      toLocationId,
      productId,
      qty,
      notes,
      status: "pending",
      createdBy: userId,
    },
    include: { fromLocation: true, toLocation: true, product: true },
  });

  return NextResponse.json(transfer, { status: 201 });
}
