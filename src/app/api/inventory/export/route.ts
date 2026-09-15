import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditProduct, roleFromSession } from "@/lib/permissions";
import { buildInventoryView, type AlertMode } from "@/lib/inventory-view";

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function formatCategory(category: string) {
  if (category === "12V") return "12V";
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseAlertMode(value: string | null): AlertMode {
  if (value === "short" || value === "aging") return value;
  return "all";
}

function filterSummary(input: {
  locName: string;
  category: string | null;
  search: string | null;
  status: string | null;
  backorderActive: boolean;
  alertMode: AlertMode;
}): string {
  const parts = [input.locName];
  if (input.category) parts.push(formatCategory(input.category));
  if (input.search) parts.push(`search "${input.search}"`);
  if (input.backorderActive) {
    parts.push("backorder");
    if (input.alertMode !== "all") parts.push(input.alertMode);
  } else if (input.status) {
    parts.push(input.status.replace(/_/g, " ").toLowerCase());
  }
  return parts.join(" · ");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditProduct(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const locations = await prisma.location.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const locName = sp.get("loc")?.trim() || locations[0]?.name || "";
  const activeLocation = locations.find((l) => l.name === locName) ?? locations[0] ?? null;
  if (!activeLocation) {
    return NextResponse.json({ error: "No location" }, { status: 404 });
  }

  const backorderActive = sp.get("backorder") === "1";
  const alertMode = parseAlertMode(sp.get("alert"));
  const category = sp.get("category")?.trim() || undefined;
  const search = sp.get("search")?.trim() || undefined;
  const status = backorderActive ? undefined : sp.get("status")?.trim() || undefined;

  const view = await buildInventoryView({
    locationId: activeLocation.id,
    locationName: activeLocation.name,
    category,
    search,
    status,
    forecastActive: false,
    incomingOnly: false,
    backorderActive,
    alertMode,
    includeAging: true,
    page: 1,
    pageSize: 100000,
  });

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
    "On Hand",
    "Reserved",
    "Available",
    "Reorder Point",
    "Status",
  ];

  const lines = [
    csvCell(`Inventory — ${filterSummary({
      locName: activeLocation.name,
      category: category ?? null,
      search: search ?? null,
      status: status ?? null,
      backorderActive,
      alertMode,
    })} — ${generatedAt}`),
    header.map(csvCell).join(","),
    ...view.rows.map((r) =>
      [
        r.sku,
        r.name,
        formatCategory(r.category),
        r.unit,
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
  const locSlug = activeLocation.name.toLowerCase().replace(/\s+/g, "-");
  const filename = `inventory-${locSlug}-${stamp}.csv`;
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
