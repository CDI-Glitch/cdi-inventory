import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InventoryTable } from "@/components/inventory/inventory-table";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; search?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const params = await searchParams;

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

  const locations = await prisma.location.findMany({ where: { active: true } });

  // Batch compute stock
  const [allLogs, allMovements] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["productId", "locationId"],
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["productId", "locationId"],
      where: { reservedQty: { gt: 0 } },
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

  const rows = products.map((product) => {
    const byLocation: Record<string, { onHand: number; reserved: number; available: number }> = {};
    let totalOnHand = 0;
    let totalReserved = 0;

    for (const loc of locations) {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <div className="flex gap-2">
          {role === "admin" && (
            <>
              <Link
                href="/inventory/new"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Add SKU
              </Link>
              <Link
                href="/inventory/adjust"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Adjust Stock
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-4">
        <input
          name="search"
          defaultValue={params.search}
          placeholder="Search SKU or name..."
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-48"
        />
        <select
          name="category"
          defaultValue={params.category ?? ""}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="OK">OK</option>
          <option value="REORDER">Reorder</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium hover:bg-gray-200"
        >
          Filter
        </button>
      </form>

      <InventoryTable rows={filtered} locationNames={locations.map((l) => l.name)} />
    </div>
  );
}
