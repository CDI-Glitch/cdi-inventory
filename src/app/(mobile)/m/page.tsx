import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { countShortSkus, getLowStockRows } from "@/lib/dashboard-stats";

export default async function MobileHomePage() {
  const session = await auth();
  const userName = (session?.user as { name?: string } | undefined)?.name ?? "";

  const locations = await prisma.location.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const defaultLoc =
    locations.find((l) => l.name.toLowerCase() === userName.toLowerCase())?.name ??
    locations[0]?.name ??
    "";
  const locParam = defaultLoc ? `loc=${encodeURIComponent(defaultLoc)}` : "";
  const inventoryHref = locParam ? `/m/inventory?${locParam}` : "/m/inventory";
  const shortHref = locParam
    ? `/m/inventory?${locParam}&backorder=1`
    : "/m/inventory?backorder=1";
  const activeLocation = locations.find((l) => l.name === defaultLoc);

  const [shortCount, lowStock] = await Promise.all([
    countShortSkus(activeLocation?.id),
    getLowStockRows(8),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Lookup</h1>
      <p className="text-sm text-gray-500">
        Read-only stock numbers. No sales records, no adjustments.
      </p>

      <Link
        href={shortHref}
        className={cn(
          "block rounded-lg border bg-white p-4",
          shortCount > 0 ? "border-red-200" : "border-gray-200"
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Short at {defaultLoc || "warehouse"}
        </p>
        <p className={cn("mt-1 text-3xl font-bold", shortCount > 0 ? "text-red-600" : "text-gray-900")}>
          {shortCount}
        </p>
        <p className={cn("mt-1 text-xs", shortCount > 0 ? "text-red-600" : "text-[#2563EB]")}>
          Available &lt; 0 · tap to list
        </p>
      </Link>

      <Link
        href={inventoryHref}
        className="block rounded-lg border border-gray-200 bg-white p-4 text-sm font-medium text-[#2563EB]"
      >
        Browse all SKUs →
      </Link>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Low stock</h2>
        </div>
        {lowStock.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">All stock levels OK</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {lowStock.map((p) => (
              <li key={p.rowKey} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-gray-900">{p.sku}</p>
                  <p className="truncate text-xs text-gray-500">
                    {p.name} · {p.locationName}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-orange-600">{p.available}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
