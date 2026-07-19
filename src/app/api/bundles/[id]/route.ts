import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { COMPONENT_ROLES } from "@/lib/constants";

const UpdateBundleSchema = z.object({
  name: z.string().min(1).optional(),
  productFamily: z.string().min(1).optional(),
  active: z.boolean().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    productId: z.string().min(1),
    qty: z.number().int().min(1),
    componentRole: z.enum(COMPONENT_ROLES),
    required: z.boolean().default(true),
    sortOrder: z.number().int(),
    notes: z.string().optional(),
  })).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bundle = await prisma.bundleDefinition.findUnique({
    where: { id },
    include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
  });

  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bundle);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateBundleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, ...rest } = parsed.data;

  // If items provided, replace all items
  if (items !== undefined) {
    await prisma.bundleItem.deleteMany({ where: { bundleId: id } });
    await prisma.bundleItem.createMany({
      data: items.map(({ id: _itemId, ...item }) => ({ ...item, bundleId: id })),
    });
  }

  const bundle = await prisma.bundleDefinition.update({
    where: { id },
    data: rest,
    include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(bundle);
}
