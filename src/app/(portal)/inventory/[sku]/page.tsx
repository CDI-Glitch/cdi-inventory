import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getStock } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import SKUDetailHeader from "@/components/inventory/sku-detail-header";
import { ShopifyBindingPanel } from "@/components/inventory/shopify-binding-panel";
import { Pagination } from "@/components/ui/pagination";
import { asRole, canAdjustStock, canBindShopify } from "@/lib/permissions";

const PAGE_SIZE = 50;

const LOG_TYPE_LABELS: Record<string, string> = {
  opening_stock: "Opening stock",
  receive_stock: "Received",
  sales_deduction: "Sales deduction",
  adjustment_in: "Adjustment in",
  adjustment_out: "Adjustment out",
  write_off: "Write-off",
  stocktake_correction: "Stocktake correction",
  transfer_out: "Transfer out",
  transfer_in: "Transfer in",
};

export default async function SKUDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  const role = asRole((session?.user as any)?.role);
  const canAdjust = canAdjustStock(role);
  const isAdmin = canBindShopify(role);

  const { sku } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const product = await prisma.product.findUnique({
    where: { sku: decodeURIComponent(sku) },
  });
  if (!product) notFound();

  const locations = await prisma.location.findMany({ where: { active: true } });

  const stockByLocation = await Promise.all(
    locations.map(async (loc) => ({
      location: loc,
      stock: await getStock(product.id, loc.id, product.reorderPoint),
    }))
  );

  const where = { productId: product.id };
  const [logs, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { location: true },
    }),
    prisma.inventoryLog.count({ where }),
  ]);

  const srRefs = [...new Set(logs.map((l) => l.reference).filter((r): r is string => !!r && r.startsWith("SR-")))];
  const sales =
    srRefs.length > 0
      ? await prisma.salesRecord.findMany({
          where: { recordId: { in: srRefs } },
          select: { id: true, recordId: true },
        })
      : [];
  const salesIdByRecordId = Object.fromEntries(sales.map((s) => [s.recordId, s.id]));

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/inventory" className="text-sm text-gray-500 hover:text-gray-700">
          ← Inventory
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono font-semibold text-gray-900">{product.sku}</span>
      </div>

      <SKUDetailHeader
        sku={product.sku}
        productId={product.id}
        name={product.name}
        category={product.category}
        unit={product.unit}
        adminNotes={product.adminNotes}
        reorderPoint={product.reorderPoint}
        stockByLocation={stockByLocation}
        locations={locations}
        canAdjust={canAdjust}
      />

      {isAdmin && (
        <div className="mb-6">
          <ShopifyBindingPanel
            sku={product.sku}
            shopifyInventoryItemId={product.shopifyInventoryItemId ?? null}
            shopifyVariantId={product.shopifyVariantId ?? null}
          />
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Stock movement history</h2>
      {total === 0 ? (
        <p className="text-sm text-gray-500">No movements yet.</p>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Location</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Delta</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Reference</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const salesId = log.reference ? salesIdByRecordId[log.reference] : undefined;
                  return (
                    <tr key={log.id} className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{LOG_TYPE_LABELS[log.type] ?? log.type}</td>
                      <td className="px-4 py-2.5 text-gray-500">{log.location.name}</td>
                      <td className={cn("px-4 py-2.5 text-center font-mono font-medium", log.delta > 0 ? "text-green-600" : "text-red-600")}>
                        {log.delta > 0 ? `+${log.delta}` : log.delta}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {salesId ? (
                          <Link href={`/sales/${salesId}`} className="text-[#2563EB] hover:underline">
                            {log.reference}
                          </Link>
                        ) : (
                          <span className="text-gray-500">{log.reference ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{log.notes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {from}–{to} of {total.toLocaleString()}
              </p>
              <Pagination currentPage={page} totalPages={totalPages} searchParams={{}} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
