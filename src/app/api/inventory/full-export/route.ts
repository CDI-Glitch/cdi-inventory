import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canEditProduct, roleFromSession } from "@/lib/permissions";
import { getFullInventoryExportRows } from "@/lib/full-inventory-export";

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditProduct(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rows, locationNames } = await getFullInventoryExportRows();
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
    "单位",
    ...locationNames.map((name) => `On Hand (${name})`),
    "Total On Hand",
    "Total Reserved",
    "Total Available",
    "Reorder Point",
    "Status",
  ];

  const lines = [
    csvCell(`Inventory — all locations — ${generatedAt}`),
    header.map(csvCell).join(","),
    ...rows.map((r) =>
      [
        r.sku,
        r.name,
        r.category,
        r.unit,
        ...locationNames.map((name) => r.byLocation[name]?.onHand ?? 0),
        r.totalOnHand,
        r.totalReserved,
        r.totalAvailable,
        r.reorderPoint,
        r.status,
      ]
        .map(csvCell)
        .join(",")
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `inventory-full-export-${stamp}.csv`;
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
