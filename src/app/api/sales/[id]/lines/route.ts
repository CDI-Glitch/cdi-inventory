import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const SalesLineSchema = z.object({
  lineType: z.enum(["sku", "bundle"]),
  itemCode: z.string().min(1),
  qty: z.number().int().min(1),
  notes: z.string().optional(),
});

const PutLinesSchema = z.object({
  lines: z.array(SalesLineSchema).min(1, "At least one line is required"),
});

// PUT /api/sales/[id]/lines — replace all lines (only allowed in quote status)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = PutLinesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.salesRecord.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (record.status !== "quote") {
    return NextResponse.json(
      { error: "Lines can only be edited while the record is in Quote status." },
      { status: 400 }
    );
  }

  const { lines } = parsed.data;

  // Validate each line's itemCode
  for (const line of lines) {
    if (line.lineType === "sku") {
      const product = await prisma.product.findUnique({ where: { sku: line.itemCode } });
      if (!product) return NextResponse.json({ error: `SKU not found: ${line.itemCode}` }, { status: 404 });
      if (!product.active) return NextResponse.json({ error: `SKU inactive: ${line.itemCode}` }, { status: 400 });
    } else {
      const bundle = await prisma.bundleDefinition.findUnique({ where: { code: line.itemCode } });
      if (!bundle) return NextResponse.json({ error: `Bundle not found: ${line.itemCode}` }, { status: 404 });
      if (!bundle.active) return NextResponse.json({ error: `Bundle inactive: ${line.itemCode}` }, { status: 400 });
    }
  }

  // Replace all lines: delete existing, create new
  await prisma.salesLine.deleteMany({ where: { salesRecordId: id } });
  await prisma.salesLine.createMany({
    data: lines.map((line, idx) => ({
      salesRecordId: id,
      lineType: line.lineType,
      itemCode: line.itemCode,
      qty: line.qty,
      notes: line.notes ?? null,
      sortOrder: idx,
    })),
  });

  const updated = await prisma.salesRecord.findUniqueOrThrow({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(updated);
}
