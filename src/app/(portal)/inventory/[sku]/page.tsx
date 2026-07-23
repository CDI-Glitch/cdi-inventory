import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getStock } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import SKUDetailHeader from "@/components/inventory/sku-detail-header";

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
}: {
  params: Promise<{ sku: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  const canAdjust = role === "admin" || role === "editor";

  const { sku } = await params;

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

  const logs = await prisma.inventoryLog.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { location: true },
  });

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

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Stock movement history</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-500">No movements yet.</p>
      ) : (
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
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{LOG_TYPE_LABELS[log.type] ?? log.type}</td>
                  <td className="px-4 py-2.5 text-gray-500">{log.location.name}</td>
                  <td className={cn("px-4 py-2.5 text-center font-mono font-medium", log.delta > 0 ? "text-green-600" : "text-red-600")}>
                    {log.delta > 0 ? `+${log.delta}` : log.delta}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{log.reference ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{log.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
