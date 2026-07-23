import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const PatchSchema = z.object({
  reorderPoint: z.number().int().min(0).optional(),
  adminNotes:   z.string().optional(),
  active:       z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { sku } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { sku: decodeURIComponent(sku) },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.product.update({
    where: { sku: decodeURIComponent(sku) },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}
