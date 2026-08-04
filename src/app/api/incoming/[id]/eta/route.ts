import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const EtaSchema = z.object({
  eta: z.string().min(1, "ETA is required"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role !== "admin" && role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = EtaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const shipment = await prisma.incomingShipment.findUniqueOrThrow({ where: { id } });

  if (shipment.status === "confirmed" || shipment.status === "cancelled") {
    return NextResponse.json(
      { error: `ETA cannot be changed once a shipment is "${shipment.status}".` },
      { status: 400 }
    );
  }

  const updated = await prisma.incomingShipment.update({
    where: { id },
    data: { eta: new Date(parsed.data.eta) },
    include: {
      location: true,
      lines: { include: { product: true }, orderBy: { id: "asc" } },
    },
  });

  return NextResponse.json(updated);
}
