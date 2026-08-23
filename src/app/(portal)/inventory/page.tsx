import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { ForecastToggle } from "@/components/inventory/forecast-toggle";
import { BackorderToggle } from "@/components/inventory/backorder-toggle";
import { FactoryListButton } from "@/components/inventory/factory-list-button";
import { LocationTabs } from "@/components/ui/location-tabs";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";
import { asRole, canAdjustStock, canCreateProduct } from "@/lib/permissions";
import { buildInventoryView, INVENTORY_PAGE_SIZE } from "@/lib/inventory-view";

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
    incomingOnly?: string;
    backorder?: string;
    alert?: string;
  }>;
}) {
  const session = await auth();
  const role = asRole((session?.user as any)?.role);
  const userName = (session?.user as any)?.name ?? "";
  const params = await searchParams;

  const locations = await prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  const defaultLoc =
    params.loc !== undefined
      ? params.loc
      : locations.find((l) => l.name.toLowerCase() === userName.toLowerCase())?.name
        ?? locations[0]?.name
        ?? "";

  const activeLoc = defaultLoc;
  const activeLocation = locations.find((l) => l.name === activeLoc) ?? locations[0] ?? null;
  const locationName = activeLocation?.name ?? locations[0]?.name ?? "";
  const locationId = activeLocation?.id ?? locations[0]?.id ?? "";

  const forecastActive = params.forecast === "1";
  const backorderActive = params.backorder === "1" && !forecastActive;
  const alertMode =
    params.alert === "short" || params.alert === "aging" ? params.alert : "all";

  const view = await buildInventoryView({
    locationId,
    locationName,
    category: params.category,
    search: params.search,
    status: params.status,
    forecastActive,
    incomingOnly: params.incomingOnly === "1",
    backorderActive,
    alertMode,
    includeAging: true,
    page: Math.max(1, parseInt(params.page ?? "1", 10)),
    pageSize: INVENTORY_PAGE_SIZE,
  });

  const paginationParams: Record<string, string | undefined> = {
    loc: activeLoc || undefined,
    category: params.category || undefined,
    status: view.backorderActive ? undefined : params.status || undefined,
    search: params.search || undefined,
    forecast: view.forecastActive ? "1" : undefined,
    incomingOnly: view.incomingOnlyActive ? "1" : undefined,
    backorder: view.backorderActive ? "1" : undefined,
    alert: view.backorderActive && view.alertMode !== "all" ? view.alertMode : undefined,
  };

  const forecastToggleParams = new URLSearchParams();
  if (activeLoc) forecastToggleParams.set("loc", activeLoc);
  if (params.category) forecastToggleParams.set("category", params.category);
  if (params.status) forecastToggleParams.set("status", params.status);
  if (params.search) forecastToggleParams.set("search", params.search);
  if (!view.forecastActive) {
    forecastToggleParams.set("forecast", "1");
  }
  if (view.incomingOnlyActive) forecastToggleParams.set("incomingOnly", "1");
  const forecastToggleHref = `/inventory?${forecastToggleParams.toString()}`;

  const backorderToggleParams = new URLSearchParams();
  if (activeLoc) backorderToggleParams.set("loc", activeLoc);
  if (params.category) backorderToggleParams.set("category", params.category);
  if (params.search) backorderToggleParams.set("search", params.search);
  if (view.backorderActive && params.status) {
    backorderToggleParams.set("status", params.status);
  }
  if (!view.backorderActive) {
    backorderToggleParams.set("backorder", "1");
  }
  const backorderToggleHref = `/inventory?${backorderToggleParams.toString()}`;

  return (
    <div className="-m-8 flex h-screen flex-col">
      <div className="shrink-0 bg-white px-8 pt-8 pb-3">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <div className="flex gap-2">
            <ForecastToggle active={view.forecastActive} href={forecastToggleHref} />
            <BackorderToggle active={view.backorderActive} href={backorderToggleHref} />
            {view.backorderActive && activeLoc && <FactoryListButton loc={activeLoc} />}
            {canCreateProduct(role) && (
              <Link
                href="/inventory/new"
                className="rounded-md bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]"
              >
                + Add SKU
              </Link>
            )}
            {canAdjustStock(role) && (
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
          defaultAlert={view.alertMode}
          defaultIncomingOnly={view.incomingOnlyActive ? "1" : undefined}
          currentLoc={activeLoc}
          currentForecast={view.forecastActive ? "1" : undefined}
          currentBackorder={view.backorderActive ? "1" : undefined}
        />
      </div>

      <div className="mx-8 flex min-h-0 flex-1 flex-col">
        {view.backorderActive && (
          <p className="mb-2 shrink-0 text-sm text-gray-500">
            {view.alertCount} alert{view.alertCount === 1 ? "" : "s"}
            {view.shortCount > 0 ? ` · ${view.shortCount} short` : ""}
            {view.agingOnlyCount > 0 ? ` · ${view.agingOnlyCount} aging only` : ""}
          </p>
        )}
        <InventoryTable
          rows={view.rows}
          locationName={locationName}
          forecast={view.forecastActive}
          containers={view.containers}
          backorder={view.backorderActive}
          agingByProductId={view.agingByProductId}
          canLinkContainers={canAdjustStock(role)}
        />
      </div>

      <div className="shrink-0 px-8 py-3">
        <Pagination
          currentPage={view.currentPage}
          totalPages={view.totalPages}
          searchParams={paginationParams}
        />
      </div>
    </div>
  );
}
