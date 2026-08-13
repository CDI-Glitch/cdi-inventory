import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getShortageRows } from "@/lib/shortage-report";

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function formatEta(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locName = req.nextUrl.searchParams.get("loc")?.trim() ?? "";
  if (!locName) {
    return NextResponse.json({ error: "loc is required" }, { status: 400 });
  }

  const location = await prisma.location.findFirst({
    where: { name: locName, active: true },
    select: { id: true, name: true },
  });
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const rows = await getShortageRows(location.id);
  const generatedAt = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const header = [
    "SKU",
    "名称",
    "分类",
    "现货 On Hand",
    "预留 Reserved",
    "缺货 Short",
    "最近货柜 PO",
    "ETA",
    "货柜数量",
  ];

  const lines = [
    csvCell(`Shortage — ${location.name} — ${generatedAt}`),
    header.map(csvCell).join(","),
    ...rows.map((r) =>
      [
        r.sku,
        r.name,
        r.category,
        r.onHand,
        r.reserved,
        r.shortQty,
        r.nearestIncoming?.poRef ?? "",
        r.nearestIncoming ? formatEta(r.nearestIncoming.eta) : "",
        r.nearestIncoming?.qtyOrdered ?? "",
      ]
        .map(csvCell)
        .join(",")
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `shortage-${location.name.toLowerCase()}-${stamp}.csv`;
  const body = `\uFEFF${lines.join("\r\n")}\r\n`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
