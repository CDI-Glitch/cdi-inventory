import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";

const CreateProductSchema = z.object({
  sku: z.string().regex(/^[A-Z0-9\-]+$/, "SKU must be uppercase letters, numbers, hyphens only"),
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  unit: z.string().default("Each"),
  reorderPoint: z.number().int().min(0).default(10),
  adminNotes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const activeOnly = searchParams.get("active") !== "false";

  const products = await prisma.product.findMany({
    where: {
      ...(activeOnly ? { active: true } : {}),
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { sku: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (existing) {
    return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
  }

  const product = await prisma.product.create({ data });
  return NextResponse.json(product, { status: 201 });
}
