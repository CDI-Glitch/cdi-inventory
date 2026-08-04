import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { ForecastToggle } from "@/components/inventory/forecast-toggle";
import { LocationTabs } from "@/components/ui/location-tabs";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";

const FORECAST_ELIGIBLE_STATUSES = ["shipped", "in_transit", "arrived"];
const FORECAST_MAX_CONTAINERS = 5;

const PAGE_SIZE = 50;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    status?: string;
    search?: string;
    loc?: string;
    page?: string;
    forecast?: string;
  }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userName = (session?.user as any)?.name ?? "";
  const params = await searchParams;

  const locations = await prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  // Default: editor → their own warehouse, admin/viewer → first location alphabetically
  const defaultLoc =
    params.loc !== undefined
      ? params.loc
      : locations.find((l) => l.name.toLowerCase() === userName.toLowerCase())?.name
        ?? locations[0]?.name
        ?? "";

  const activeLoc = defaultLoc;
  const activeLocation = locations.find((l) => l.name === activeLoc) ?? locations[0] ?? null;

  // Forecast Mode: read-only projection, scoped to the single active location. No new
  // reservation/pegging concept — see docs/constitution.md decision log for the full
  // reasoning. Eligible containers: status shipped/in_transit/arrived AND eta known,
  // sorted by ETA ascending (closest first), capped at 5 columns.
  const forecastActive = params.forecast === "1";

  const forecastContainers = forecastActive && activeLocation
    ? await prisma.incomingShipment.findMany({
        where: {
          locationId: activeLocation.id,
          status: { in: FORECAST_ELIGIBLE_STATUSES },
          eta: { not: null },
        },
        orderBy: { eta: "asc" },
        take: FORECAST_MAX_CONTAINERS,
        include: { lines: true },
      })
    : [];

  const containers = forecastContainers.map((c) => ({
    id: c.id,
    poRef: c.poRef,
    eta: c.eta!.toISOString(),
  }));

  // productId -> qtyOrdered per container column (summed across multiple lines of the
  // same SKU within one container). Sized to containers.length so every product row
  // gets a fixed-length array, even for containers it has no line in (stays 0).
  const forecastQtyMap = new Map<string, number[]>();
  forecastContainers.forEach((container, idx) => {
    const perProduct = new Map<string, number>();
    for (const line of container.lines) {
      perProduct.set(line.productId, (perProduct.get(line.productId) ?? 0) + line.qtyOrdered);
    }
    for (const [productId, qty] of perProduct) {
      if (!forecastQtyMap.has(productId)) {
        forecastQtyMap.set(productId, new Array(containers.length).fill(0));
      }
      forecastQtyMap.get(productId)![idx] = qty;
    }
  });

  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(params.category ? { category: params.category } : {}),
      ...(params.search
        ? {
            OR: [
              { sku: { contains: params.search, mode: "insensitive" } },
              { name: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { sku: "asc" },
  });

  // Always single-location scope
  const [allLogs, allMovements] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["productId"],
      where: activeLocation ? { locationId: activeLocation.id } : { locationId: locations[0]?.id },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["productId"],
      where: {
        reservedQty: { gt: 0 },
        locationId: activeLocation?.id ?? locations[0]?.id,
      },
      _sum: { reservedQty: true },
    }),
  ]);

  const logMap = new Map<string, number>();
  for (const log of allLogs) {
    logMap.set(log.productId, log._sum.delta ?? 0);
  }
  const movMap = new Map<string, number>();
  for (const mov of allMovements) {
    movMap.set(mov.productId, mov._sum.reservedQty ?? 0);
  }

  const locationName = activeLocation?.name ?? locations[0]?.name ?? "";

  const rows = products.map((product) => {
    const onHand = logMap.get(product.id) ?? 0;
    const reserved = movMap.get(product.id) ?? 0;
    const available = onHand - reserved;
    const byLocation = { [locationName]: { onHand, reserved, available } };

    let status: "OK" | "REORDER" | "OUT_OF_STOCK" = "OK";
    if (available <= 0) status = "OUT_OF_STOCK";
    else if (available <= product.reorderPoint) status = "REORDER";

    // Future Available = onHand − reserved + cumulative qtyOrdered up to this column.
    // `reserved` is a static snapshot at request time (supply forecast, not demand
    // forecast) — recomputed live on every page load, never written anywhere.
    const forecastQtys = forecastQtyMap.get(product.id) ?? new Array(containers.length).fill(0);
    const forecastAvailable: number[] = [];
    let cumulative = available;
    for (const qty of forecastQtys) {
      cumulative += qty;
      forecastAvailable.push(cumulative);
    }

    return {
      ...product,
      byLocation,
      totalOnHand: onHand,
      totalReserved: reserved,
      totalAvailable: available,
      status,
      forecastQtys,
      forecastAvailable,
    };
  });

  const filtered = params.status ? rows.filter((r) => r.status === params.status) : rows;

  // Pagination
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10));
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Pass all current searchParams to Pagination for building URLs
  const paginationParams: Record<string, string | undefined> = {
    loc: activeLoc || undefined,
    category: params.category || undefined,
    status: params.status || undefined,
    search: params.search || undefined,
    forecast: forecastActive ? "1" : undefined,
  };

  // Toggle target URL: preserves every other current param, only flips `forecast`
  const forecastToggleParams = new URLSearchParams();
  if (activeLoc) forecastToggleParams.set("loc", activeLoc);
  if (params.category) forecastToggleParams.set("category", params.category);
  if (params.status) forecastToggleParams.set("status", params.status);
  if (params.search) forecastToggleParams.set("search", params.search);
  if (!forecastActive) forecastToggleParams.set("forecast", "1");
  const forecastToggleHref = `/inventory?${forecastToggleParams.toString()}`;

  return (
    // Fill portal viewport: fixed chrome + table card (pinned header, scrolling rows) + pagination
    <div className="-m-8 flex h-screen flex-col">
      <div className="shrink-0 bg-white px-8 pt-8 pb-3">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <div className="flex gap-2">
            <ForecastToggle active={forecastActive} href={forecastToggleHref} />
            {role === "admin" && (
              <Link
                href="/inventory/new"
                className="rounded-md bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]"
              >
                + Add SKU
              </Link>
            )}
            {(role === "admin" || role === "editor") && (
              <Link
                href="/inventory/adjust"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Adjust Stock
              </Link>
            )}
          </div>
        </div>

        <LocationTabs locations={locations} current={activeLoc} />

        <InventoryFilters
          defaultSearch={params.search}
          defaultCategory={params.category}
          defaultStatus={params.status}
          currentLoc={activeLoc}
          currentForecast={forecastActive ? "1" : undefined}
        />
      </div>

      <div className="mx-8 flex min-h-0 flex-1 flex-col">
        <InventoryTable
          rows={paginated}
          locationName={locationName}
          forecast={forecastActive}
          containers={containers}
          canLinkContainers={role === "admin" || role === "editor"}
        />
      </div>

      <div className="shrink-0 px-8 py-3">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          searchParams={paginationParams}
        />
      </div>
    </div>
  );
}
