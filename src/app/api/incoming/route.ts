import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const CreateIncomingSchema = z.object({
  supplierName: z.string().min(1),
  poNumber: z.string().optional(),
  eta: z.string().optional(),
  notes: z.string().optional(),
  locationId: z.string().min(1),
  lines: z.array(z.object({
    productId: z.string().min(1),
    qtyOrdered: z.number().int().min(1),
    unitCost: z.number().min(0).optional(),
    notes: z.string().optional(),
  })).min(1, "Shipment must have at least one line"),
});

async function nextPoRef(): Promise<string> {
  const last = await prisma.incomingShipment.findFirst({
    orderBy: { createdAt: "desc" },
    select: { poRef: true },
  });
  if (!last) return "PO-0001";
  const num = parseInt(last.poRef.replace("PO-", ""), 10);
  return `PO-${String(num + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const shipments = await prisma.incomingShipment.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { supplierName: { contains: search, mode: "insensitive" } },
              { poRef: { contains: search, mode: "insensitive" } },
              { poNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { location: true, lines: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(shipments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = CreateIncomingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lines, ...shipmentData } = parsed.data;
  const poRef = await nextPoRef();

  const shipment = await prisma.incomingShipment.create({
    data: {
      poRef,
      supplierName: shipmentData.supplierName,
      poNumber: shipmentData.poNumber,
      eta: shipmentData.eta ? new Date(shipmentData.eta) : null,
      notes: shipmentData.notes,
      locationId: shipmentData.locationId,
      status: "pending",
      lines: { create: lines },
    },
    include: {
      location: true,
      lines: { include: { product: true } },
    },
  });

  return NextResponse.json(shipment, { status: 201 });
}
