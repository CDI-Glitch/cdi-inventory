import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { INVENTORY_LOG_TYPES } from "@/lib/constants";

const AdjustSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  type: z.enum(INVENTORY_LOG_TYPES),
  delta: z.number().int().refine((n) => n !== 0, "Delta cannot be zero"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = AdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { productId, locationId, type, delta, reference, notes } = parsed.data;
  const userId = (session.user as any)?.id;

  // Validate product and location exist
  const [product, location] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.location.findUnique({ where: { id: locationId } }),
  ]);

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const log = await prisma.inventoryLog.create({
    data: { productId, locationId, type, delta, reference, enteredBy: userId, notes },
  });

  return NextResponse.json(log, { status: 201 });
}
