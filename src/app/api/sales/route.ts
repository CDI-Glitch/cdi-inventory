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

const CreateSalesSchema = z.object({
  customer: z.string().min(1),
  date: z.string().min(1),
  locationId: z.string().min(1),
  invoiceNo: z.string().optional(),
  quoteNo: z.string().optional(),
  staffNotes: z.string().optional(),
  lines: z.array(SalesLineSchema).min(1, "At least one line is required"),
});

async function nextRecordId(): Promise<string> {
  const last = await prisma.salesRecord.findFirst({
    orderBy: { createdAt: "desc" },
    select: { recordId: true },
  });
  if (!last) return "SR-0001";
  const num = parseInt(last.recordId.replace("SR-", ""), 10);
  return `SR-${String(num + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const records = await prisma.salesRecord.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { customer: { contains: search, mode: "insensitive" } },
              { recordId: { contains: search, mode: "insensitive" } },
              { invoiceNo: { contains: search, mode: "insensitive" } },
              { quoteNo: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      location: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = CreateSalesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Validate location
  const location = await prisma.location.findUnique({ where: { id: data.locationId } });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  // Validate each line's itemCode
  for (const line of data.lines) {
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

  const recordId = await nextRecordId();

  const record = await prisma.salesRecord.create({
    data: {
      recordId,
      date: new Date(data.date),
      customer: data.customer,
      status: "quote",
      locationId: data.locationId,
      invoiceNo: data.invoiceNo,
      quoteNo: data.quoteNo,
      staffNotes: data.staffNotes,
      lines: {
        create: data.lines.map((line, idx) => ({
          lineType: line.lineType,
          itemCode: line.itemCode,
          qty: line.qty,
          notes: line.notes,
          sortOrder: idx,
        })),
      },
    },
    include: {
      location: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(record, { status: 201 });
}
