import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getAgingReservations } from "@/lib/reservation-aging";
import { getStockForProductLocationPairs, getStockForProducts } from "@/lib/inventory";
import { findSharedComponentBottlenecks } from "@/lib/bundle-atp";
import { asRole, canSeeDashboardActions } from "@/lib/permissions";

const SALES_STATUS_STYLES: Record<string, string> = {
  quote: "bg-gray-100 text-gray-600",
  deposit_paid: "bg-blue-100 text-[#1D4ED8]",
  fully_paid: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

const SALES_STATUS_LABELS: Record<string, string> = {
  quote: "Quote",
  deposit_paid: "Deposit paid",
  fully_paid: "Fully paid",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>;
}) {
  const session = await auth();
  const role = asRole((session?.user as any)?.role);
  const params = await searchParams;
  const agingLoc = params.loc ?? "all";

  const [
    totalProducts,
    totalLocations,
    totalBundles,
    activeSalesRecords,
    recentSales,
    pendingIncoming,
    lowStockItems,
    locations,
  ] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.location.count({ where: { active: true } }),
    prisma.bundleDefinition.count({ where: { active: true } }),
    prisma.salesRecord.count({ where: { status: { in: ["quote", "deposit_paid", "fully_paid"] } } }),
    prisma.salesRecord.findMany({
      where: { status: { in: ["quote", "deposit_paid", "fully_paid"] } },
      include: {
        location: true,
        lines: { orderBy: { sortOrder: "asc" }, take: 2 },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.incomingShipment.count({
      where: { status: { in: ["pending", "shipped", "in_transit", "arrived"] } },
    }),
    // Low stock: products where aggregate InventoryLog delta is <= reorderPoint
    // Simplified: get all active products with reorderPoint
    prisma.product.findMany({
      where: { active: true },
      orderBy: { sku: "asc" },
      take: 50,
    }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const agingLocation = agingLoc !== "all" ? locations.find((l) => l.name === agingLoc) : undefined;
  const agingReservations = await getAgingReservations(
    agingLocation ? { locationId: agingLocation.id } : {}
  );
  const [sharedBottlenecks, sellableBundles] = await Promise.all([
    findSharedComponentBottlenecks(),
    prisma.bundleDefinition.findMany({
      where: { active: true, sellableSku: { not: null } },
      include: {
        locationStocks: { include: { location: { select: { name: true } } } },
      },
      orderBy: { code: "asc" },
    }),
  ]);
  const agingToggleHref = (loc: string) => `/dashboard?loc=${loc}`;
  const inventoryAlertHref = `/inventory?loc=${agingLocation?.name ?? locations[0]?.name ?? ""}&backorder=1`;

  const productIds = lowStockItems.map((p) => p.id);
  let lowStock: {
    id: string;
    sku: string;
    name: string;
    available: number;
    reorderPoint: number;
    locationName: string;
    rowKey: string;
  }[] = [];

  if (agingLocation) {
    const stockMap = await getStockForProducts(agingLocation.id, productIds);
    lowStock = lowStockItems
      .map((p) => {
        const s = stockMap.get(p.id) ?? { onHand: 0, reserved: 0, available: 0 };
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          available: s.available,
          onHand: s.onHand,
          reorderPoint: p.reorderPoint,
          locationName: agingLocation.name,
          rowKey: `${p.id}:${agingLocation.id}`,
        };
      })
      .filter((p) => p.available <= p.reorderPoint && p.onHand > 0)
      .slice(0, 5);
  } else {
    const pairs = locations.flatMap((loc) =>
      lowStockItems.map((p) => ({ productId: p.id, locationId: loc.id }))
    );
    const stockMap = await getStockForProductLocationPairs(pairs);
    const rows = [];
    for (const loc of locations) {
      for (const p of lowStockItems) {
        const s = stockMap.get(`${p.id}:${loc.id}`) ?? { onHand: 0, reserved: 0, available: 0 };
        if (s.available <= p.reorderPoint && s.onHand > 0) {
          rows.push({
            id: p.id,
            sku: p.sku,
            name: p.name,
            available: s.available,
            reorderPoint: p.reorderPoint,
            locationName: loc.name,
            rowKey: `${p.id}:${loc.id}`,
          });
        }
      }
    }
    lowStock = rows.sort((a, b) => a.available - b.available).slice(0, 5);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Active SKUs", value: totalProducts, href: "/inventory" },
          { label: "Locations", value: totalLocations },
          { label: "Active bundles", value: totalBundles, href: "/bundles" },
          { label: "Open orders", value: activeSalesRecords, href: "/sales" },
          {
            label: "At-risk reservations",
            value: agingReservations.length,
            href: inventoryAlertHref,
            alert: agingReservations.length > 0,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={cn(
              "rounded-lg border bg-white p-5",
              card.alert ? "border-red-200" : "border-gray-200"
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className={cn("mt-2 text-3xl font-bold", card.alert ? "text-red-600" : "text-gray-900")}>
              {card.value}
            </p>
            {card.href && (
              <Link
                href={card.href}
                className={cn(
                  "mt-2 text-xs hover:underline block",
                  card.alert ? "text-red-600" : "text-[#2563EB]"
                )}
              >
                View all →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* At-risk reservations — aging deposits and/or backordered stock, per constitution H#3 */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            At-risk reservations ({agingReservations.length})
          </h2>
          <div className="flex items-center gap-0 rounded-md border border-gray-200 overflow-hidden">
            {["all", ...locations.map((l) => l.name)].map((name) => (
              <Link
                key={name}
                href={agingToggleHref(name)}
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-colors",
                  agingLoc === name
                    ? "bg-[#2563EB] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {name === "all" ? "All" : name}
              </Link>
            ))}
          </div>
        </div>
        {agingReservations.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">No aging or backordered reservations</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {agingReservations.slice(0, 10).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <Link href={`/inventory/${r.sku}`} className="text-sm font-mono font-medium text-[#2563EB] hover:underline">
                    {r.sku}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <Link href={`/sales/${r.salesRecordDbId}`} className="text-[#2563EB] hover:underline">
                      {r.recordId}
                    </Link>
                    {" · "}
                    {r.customer}
                    {" · "}
                    {r.locationName}
                  </p>
                  {r.stockSignal === "BACKORDERED" && (
                    <p className="text-xs mt-0.5">
                      {r.nearestIncoming ? (
                        <span className="text-gray-500">
                          Next supply: <span className="font-mono">{r.nearestIncoming.poRef}</span>
                          {" · "}
                          ETA {new Date(r.nearestIncoming.eta).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                          {" · "}
                          +{r.nearestIncoming.qtyOrdered}
                        </span>
                      ) : (
                        <span className="font-medium text-red-600">No incoming stock</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {r.ageSignal && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                        r.ageSignal === "STALE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      )}
                    >
                      Aged {r.ageDays}d
                    </span>
                  )}
                  {r.stockSignal === "BACKORDERED" && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 whitespace-nowrap">
                      Short {Math.abs(r.available)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {agingReservations.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100">
            <Link href={inventoryAlertHref} className="text-xs text-[#2563EB] hover:underline">
              View all in Inventory →
            </Link>
          </div>
        )}
      </div>

      {sellableBundles.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Sellable kits (cached)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              How many complete kits can be built per warehouse. Refreshed when component stock changes.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {sellableBundles.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{b.name}</p>
                  <p className="text-xs font-mono text-gray-500 mt-0.5">
                    {b.code}
                    {b.sellableSku ? ` · ${b.sellableSku}` : ""}
                  </p>
                </div>
                <p className="text-xs text-gray-700">
                  {b.locationStocks.length === 0
                    ? "No cache yet"
                    : b.locationStocks.map((row) => `${row.location.name}: ${row.cachedKits}`).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sharedBottlenecks.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100">
            <h2 className="text-sm font-semibold text-amber-900">
              Shared kit bottleneck ({sharedBottlenecks.length})
            </h2>
            <p className="text-xs text-amber-800 mt-0.5">
              These components currently cap kits for two or more Shopify tray variants. Process those orders first — Shopify variants do not share a live pool until reservation is recorded.
            </p>
          </div>
          <div className="divide-y divide-amber-100 bg-white">
            {sharedBottlenecks.map((alert) => (
              <div key={`${alert.locationId}:${alert.key}`} className="px-5 py-3">
                <p className="text-sm font-mono font-medium text-gray-900">
                  {alert.skus.join(" / ")}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {alert.locationName}
                  {" · "}
                  available {alert.available}
                  {" · "}
                  kits from this line {alert.kitsFromGroup}
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  Caps {alert.bundleCodes.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Open orders */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Open orders ({activeSalesRecords})</h2>
            <Link href="/sales" className="text-xs text-[#2563EB] hover:underline">View all</Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No open orders</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link href={`/sales/${s.id}`} className="text-sm font-medium text-[#2563EB] hover:underline">
                      {s.recordId}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.customer}
                      {s.lines[0] && (
                        <>
                          {" · "}
                          <span className="font-mono">{s.lines[0].itemCode}</span>
                          {s.lines.length > 1 && <span className="text-gray-400"> +{s.lines.length - 1}</span>}
                        </>
                      )}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    SALES_STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"
                  )}>
                    {SALES_STATUS_LABELS[s.status] ?? s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock + Incoming */}
        <div className="space-y-4">
          {/* Low stock */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Low stock ({lowStock.length})</h2>
            </div>
            {lowStock.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">All stock levels OK</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {lowStock.map((p) => (
                  <div key={p.rowKey} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link href={`/inventory/${p.sku}`} className="text-sm font-mono font-medium text-[#2563EB] hover:underline">
                        {p.sku}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">{p.name} · {p.locationName}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-orange-600">{p.available}</span>
                      <p className="text-xs text-gray-400">avail / reorder {p.reorderPoint}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incoming */}
          {canSeeDashboardActions(role) && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Incoming shipments</h2>
                <Link href="/incoming" className="text-xs text-[#2563EB] hover:underline">View all</Link>
              </div>
              <p className="mt-2 text-3xl font-bold text-gray-900">{pendingIncoming}</p>
              <p className="text-xs text-gray-400 mt-1">In progress (not yet confirmed)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
