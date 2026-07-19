import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { COMPONENT_ROLES } from "@/lib/constants";

const CreateBundleSchema = z.object({
  code: z.string().regex(/^[A-Z0-9\-]+$/, "Code must be uppercase letters, numbers, hyphens"),
  name: z.string().min(1),
  productFamily: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    qty: z.number().int().min(1),
    componentRole: z.enum(COMPONENT_ROLES),
    required: z.boolean().default(true),
    sortOrder: z.number().int(),
    notes: z.string().optional(),
  })).min(1, "Bundle must have at least one component"),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bundles = await prisma.bundleDefinition.findMany({
    include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(bundles);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateBundleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { code, name, productFamily, items } = parsed.data;

  const existing = await prisma.bundleDefinition.findUnique({ where: { code } });
  if (existing) return NextResponse.json({ error: "Bundle code already exists" }, { status: 409 });

  const bundle = await prisma.bundleDefinition.create({
    data: {
      code,
      name,
      productFamily,
      items: { create: items },
    },
    include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(bundle, { status: 201 });
}
