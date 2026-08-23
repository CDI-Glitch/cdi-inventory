import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { LocationTabs } from "@/components/ui/location-tabs";
import { Pagination } from "@/components/ui/pagination";
import { MobileInventoryCard } from "@/components/mobile/mobile-inventory-card";
import { buildInventoryView, MOBILE_INVENTORY_PAGE_SIZE } from "@/lib/inventory-view";

export default async function MobileInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    status?: string;
    search?: string;
    loc?: string;
    page?: string;
    forecast?: string;
    incomingOnly?: string;
    backorder?: string;
  }>;
}) {
  const session = await auth();
  const userName = (session?.user as { name?: string } | undefined)?.name ?? "";
  const params = await searchParams;

  const locations = await prisma.location.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const defaultLoc =
    params.loc !== undefined
      ? params.loc
      : locations.find((l) => l.name.toLowerCase() === userName.toLowerCase())?.name ??
        locations[0]?.name ??
        "";

  const activeLocation = locations.find((l) => l.name === defaultLoc) ?? locations[0] ?? null;
  const locationName = activeLocation?.name ?? "";
  const locationId = activeLocation?.id ?? "";

  const forecastActive = params.forecast === "1";
  const backorderActive = params.backorder === "1" && !forecastActive;

  const view = await buildInventoryView({
    locationId,
    locationName,
    category: params.category,
    search: params.search,
    status: params.status,
    forecastActive,
    incomingOnly: params.incomingOnly === "1",
    backorderActive,
    alertMode: "short",
    includeAging: false,
    page: Math.max(1, parseInt(params.page ?? "1", 10)),
    pageSize: MOBILE_INVENTORY_PAGE_SIZE,
  });

  const paginationParams: Record<string, string | undefined> = {
    loc: defaultLoc || undefined,
    category: params.category || undefined,
    status: view.backorderActive ? undefined : params.status || undefined,
    search: params.search || undefined,
    forecast: view.forecastActive ? "1" : undefined,
    incomingOnly: view.incomingOnlyActive ? "1" : undefined,
    backorder: view.backorderActive ? "1" : undefined,
  };

  const title = view.forecastActive
    ? "Forecast"
    : view.backorderActive
      ? "Short stock"
      : "Inventory";

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      {view.backorderActive && (
        <p className="text-sm text-gray-500">
          {view.shortCount} SKU{view.shortCount === 1 ? "" : "s"} with available &lt; 0. Aging
          reservations are desktop-only.
        </p>
      )}
      {view.forecastActive && (
        <p className="text-sm text-gray-500">
          Estimate only — not a locked reservation against a shipment.
        </p>
      )}

      <LocationTabs locations={locations} current={defaultLoc} />

      <InventoryFilters
        defaultSearch={params.search}
        defaultCategory={params.category}
        defaultStatus={params.status}
        defaultAlert="short"
        defaultIncomingOnly={view.incomingOnlyActive ? "1" : undefined}
        currentLoc={defaultLoc}
        currentForecast={view.forecastActive ? "1" : undefined}
        currentBackorder={view.backorderActive ? "1" : undefined}
        hideAlertSelect
      />

      {view.rows.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No SKUs match.
        </p>
      ) : (
        <div className="space-y-2">
          {view.rows.map((row) => (
            <MobileInventoryCard
              key={row.id}
              row={row}
              locationName={locationName}
              forecast={view.forecastActive}
              containers={view.containers}
            />
          ))}
        </div>
      )}

      <Pagination
        currentPage={view.currentPage}
        totalPages={view.totalPages}
        searchParams={paginationParams}
      />
    </div>
  );
}
