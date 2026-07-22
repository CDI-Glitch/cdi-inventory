import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const PatchHeaderSchema = z.object({
  customer: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  quoteNo: z.string().optional(),
  invoiceNo: z.string().optional(),
  staffNotes: z.string().optional(),
});

// PATCH /api/sales/[id]/header — edit header fields (only allowed in quote status)
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
  const parsed = PatchHeaderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.salesRecord.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (record.status !== "quote") {
    return NextResponse.json(
      { error: "Header fields can only be edited while the record is in Quote status." },
      { status: 400 }
    );
  }

  // Validate locationId if provided
  if (parsed.data.locationId) {
    const location = await prisma.location.findUnique({ where: { id: parsed.data.locationId } });
    if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const data: Record<string, any> = {};
  if (parsed.data.customer !== undefined) data.customer = parsed.data.customer;
  if (parsed.data.date !== undefined) data.date = new Date(parsed.data.date);
  if (parsed.data.locationId !== undefined) data.locationId = parsed.data.locationId;
  if (parsed.data.quoteNo !== undefined) data.quoteNo = parsed.data.quoteNo || null;
  if (parsed.data.invoiceNo !== undefined) data.invoiceNo = parsed.data.invoiceNo || null;
  if (parsed.data.staffNotes !== undefined) data.staffNotes = parsed.data.staffNotes || null;

  const updated = await prisma.salesRecord.update({
    where: { id },
    data,
    include: { location: true, lines: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(updated);
}
