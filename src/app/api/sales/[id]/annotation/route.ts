import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { canEditSalesRecord, roleFromSession } from "@/lib/permissions";

const PatchAnnotationSchema = z.object({
  isFullFitOut: z.boolean(),
});

// PATCH /api/sales/[id]/annotation — edit annotation-only fields that are not
// part of the invoice/fulfillment record and are therefore editable at any
// status (unlike header fields, which lock after "quote").
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditSalesRecord(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = PatchAnnotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.salesRecord.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.salesRecord.update({
    where: { id },
    data: { isFullFitOut: parsed.data.isFullFitOut },
  });

  return NextResponse.json({ isFullFitOut: updated.isFullFitOut });
}
