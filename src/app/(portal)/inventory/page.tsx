import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { LocationTabs } from "@/components/ui/location-tabs";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";

const PAGE_SIZE = 25;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; search?: string; loc?: string; page?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userName = (session?.user as any)?.name ?? "";
  const params = await searchParams;

  const locations = await prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  // Default tab: editor → their own warehouse, admin/viewer → All
  const defaultLoc =
    params.loc !== undefined
      ? params.loc
      : role === "editor"
      ? (locations.find((l) => l.name.toLowerCase() === userName.toLowerCase())?.name ?? "")
      : "";

  const activeLoc = defaultLoc;
  const activeLocation = activeLoc ? locations.find((l) => l.name === activeLoc) : null;

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

  // Batch compute stock — scope to active location if set
  const logWhere = activeLocation ? { locationId: activeLocation.id } : {};
  const movWhere = activeLocation
    ? { reservedQty: { gt: 0 }, locationId: activeLocation.id }
    : { reservedQty: { gt: 0 } };

  const [allLogs, allMovements] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["productId", "locationId"],
      where: logWhere,
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["productId", "locationId"],
      where: movWhere,
      _sum: { reservedQty: true },
    }),
  ]);

  const logMap = new Map<string, number>();
  for (const log of allLogs) {
    logMap.set(`${log.productId}:${log.locationId}`, log._sum.delta ?? 0);
  }
  const movMap = new Map<string, number>();
  for (const mov of allMovements) {
    movMap.set(`${mov.productId}:${mov.locationId}`, mov._sum.reservedQty ?? 0);
  }

  // When single-location: only include that location's column
  const visibleLocations = activeLocation ? [activeLocation] : locations;

  const rows = products.map((product) => {
    const byLocation: Record<string, { onHand: number; reserved: number; available: number }> = {};
    let totalOnHand = 0;
    let totalReserved = 0;

    for (const loc of visibleLocations) {
      const onHand = logMap.get(`${product.id}:${loc.id}`) ?? 0;
      const reserved = movMap.get(`${product.id}:${loc.id}`) ?? 0;
      byLocation[loc.name] = { onHand, reserved, available: onHand - reserved };
      totalOnHand += onHand;
      totalReserved += reserved;
    }

    const totalAvailable = totalOnHand - totalReserved;
    let status: "OK" | "REORDER" | "OUT_OF_STOCK" = "OK";
    if (totalAvailable <= 0) status = "OUT_OF_STOCK";
    else if (totalAvailable <= product.reorderPoint) status = "REORDER";

    return { ...product, byLocation, totalOnHand, totalReserved, totalAvailable, status };
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
  };

  return (
    // Fill portal viewport: fixed chrome + table card (pinned header, scrolling rows) + pagination
    <div className="-m-8 flex h-screen flex-col">
      <div className="shrink-0 bg-white px-8 pt-8 pb-3">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <div className="flex gap-2">
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
        />
      </div>

      <div className="mx-8 flex min-h-0 flex-1 flex-col">
        <InventoryTable
          rows={paginated}
          locationNames={visibleLocations.map((l) => l.name)}
          singleLocation={!!activeLocation}
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
