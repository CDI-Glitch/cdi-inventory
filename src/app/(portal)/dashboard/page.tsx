import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SALES_STATUS_STYLES: Record<string, string> = {
  quote: "bg-gray-100 text-gray-600",
  deposit_paid: "bg-blue-100 text-[#5d7da0]",
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

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;

  const [
    totalProducts,
    totalLocations,
    totalBundles,
    activeSalesRecords,
    recentSales,
    pendingIncoming,
    lowStockItems,
  ] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.location.count({ where: { active: true } }),
    prisma.bundleDefinition.count({ where: { active: true } }),
    prisma.salesRecord.count({ where: { status: { in: ["quote", "deposit_paid", "fully_paid"] } } }),
    prisma.salesRecord.findMany({
      where: { status: { in: ["quote", "deposit_paid", "fully_paid"] } },
      include: { location: true },
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
  ]);

  // Compute available for low-stock check
  const [allLogs, allMovements] = await Promise.all([
    prisma.inventoryLog.groupBy({ by: ["productId"], _sum: { delta: true } }),
    prisma.generatedMovement.groupBy({ by: ["productId"], _sum: { reservedQty: true } }),
  ]);

  const logMap = new Map(allLogs.map((l) => [l.productId, l._sum.delta ?? 0]));
  const movMap = new Map(allMovements.map((m) => [m.productId, m._sum.reservedQty ?? 0]));

  const lowStock = lowStockItems
    .map((p) => ({
      ...p,
      onHand: logMap.get(p.id) ?? 0,
      reserved: movMap.get(p.id) ?? 0,
      available: (logMap.get(p.id) ?? 0) - (movMap.get(p.id) ?? 0),
    }))
    .filter((p) => p.available <= p.reorderPoint && p.onHand > 0)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Active SKUs", value: totalProducts, href: "/inventory" },
          { label: "Locations", value: totalLocations },
          { label: "Active bundles", value: totalBundles, href: "/bundles" },
          { label: "Open orders", value: activeSalesRecords, href: "/sales" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-gray-200 bg-white p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
            {card.href && (
              <Link href={card.href} className="mt-2 text-xs text-[#839DC0] hover:underline block">
                View all →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Open orders */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Open orders ({activeSalesRecords})</h2>
            <Link href="/sales" className="text-xs text-[#839DC0] hover:underline">View all</Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No open orders</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link href={`/sales/${s.id}`} className="text-sm font-medium text-[#839DC0] hover:underline">
                      {s.recordId}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">{s.customer} · {s.itemCode}</p>
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
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <Link href={`/inventory/${p.sku}`} className="text-sm font-mono font-medium text-[#839DC0] hover:underline">
                        {p.sku}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">{p.name}</p>
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
          {role !== "viewer" && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Incoming shipments</h2>
                <Link href="/incoming" className="text-xs text-[#839DC0] hover:underline">View all</Link>
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
