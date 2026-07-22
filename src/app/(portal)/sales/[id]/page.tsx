import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SalesStatusActions } from "@/components/sales/sales-status-actions";
import { SalesHeaderEditor } from "@/components/sales/sales-header-editor";
import { SalesLinesEditor } from "@/components/sales/sales-lines-editor";

const STATUS_STYLES: Record<string, string> = {
  quote: "bg-gray-100 text-gray-700",
  deposit_paid: "bg-blue-100 text-[#1D4ED8]",
  fully_paid: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  quote: "Quote",
  deposit_paid: "Deposit paid",
  fully_paid: "Fully paid",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function SalesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const { id } = await params;
  const isQuote = true; // evaluated below after fetch

  const record = await prisma.salesRecord.findUnique({
    where: { id },
    include: {
      location: true,
      lines: { orderBy: { sortOrder: "asc" } },
      movements: {
        include: { product: true, location: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!record) notFound();

  const recordIsQuote = record.status === "quote";
  const canEdit = role !== "viewer" && recordIsQuote;

  // Resolve item names for lines
  const lineSkus = record.lines.filter((l) => l.lineType === "sku").map((l) => l.itemCode);
  const lineBundles = record.lines.filter((l) => l.lineType === "bundle").map((l) => l.itemCode);

  const [skuProducts, bundleDefs, allLocations, allProducts, rawBundles] = await Promise.all([
    lineSkus.length > 0
      ? prisma.product.findMany({ where: { sku: { in: lineSkus } }, select: { sku: true, name: true, unit: true } })
      : Promise.resolve([]),
    lineBundles.length > 0
      ? prisma.bundleDefinition.findMany({ where: { code: { in: lineBundles } }, select: { code: true, name: true } })
      : Promise.resolve([]),
    canEdit ? prisma.location.findMany({ where: { active: true } }) : Promise.resolve([]),
    canEdit ? prisma.product.findMany({ where: { active: true }, orderBy: { sku: "asc" }, select: { sku: true, name: true, category: true } }) : Promise.resolve([]),
    canEdit
      ? prisma.bundleDefinition.findMany({
          where: { active: true },
          orderBy: { code: "asc" },
          include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
        })
      : Promise.resolve([]),
  ]);

  const skuMap = Object.fromEntries(skuProducts.map((p) => [p.sku, p]));
  const bundleMap = Object.fromEntries(bundleDefs.map((b) => [b.code, b]));

  const bundlesForEditor = rawBundles.map((b: any) => ({
    code: b.code,
    name: b.name,
    items: b.items.map((i: any) => ({ sku: i.product.sku, name: i.product.name, qty: i.qty })),
  }));

  // Format date for editor (yyyy-MM-dd)
  const dateStr = record.date.toISOString().slice(0, 10);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/sales" className="text-sm text-gray-500 hover:text-gray-700">
          ← Sales
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono font-semibold text-gray-900">{record.recordId}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-xl font-bold text-gray-900">{record.recordId}</h1>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[record.status])}>
            {STATUS_LABELS[record.status]}
          </span>
          {recordIsQuote && (
            <span className="text-xs text-gray-400 italic">Draft — no stock reserved</span>
          )}
        </div>

        <SalesHeaderEditor
          id={record.id}
          customer={record.customer}
          date={dateStr}
          locationId={record.locationId}
          locationName={record.location.name}
          locations={allLocations}
          quoteNo={record.quoteNo ?? null}
          invoiceNo={record.invoiceNo ?? null}
          staffNotes={record.staffNotes ?? null}
          isQuote={canEdit}
        />
      </div>

      {/* Status actions */}
      {role !== "viewer" && (
        <SalesStatusActions
          id={record.id}
          currentStatus={record.status}
          version={record.version}
        />
      )}

      {/* Lines table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">
            Order lines <span className="text-gray-400 font-normal">({record.lines.length})</span>
          </h2>
          {canEdit && (
            <SalesLinesEditor
              salesRecordId={record.id}
              existingLines={record.lines}
              skuOptions={allProducts}
              bundles={bundlesForEditor}
            />
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left font-medium text-gray-600 w-6">#</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Code</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Qty</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody>
              {record.lines.map((line, idx) => {
                const itemName =
                  line.lineType === "sku"
                    ? skuMap[line.itemCode]?.name ?? "—"
                    : bundleMap[line.itemCode]?.name ?? "—";
                return (
                  <tr key={line.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          line.lineType === "bundle"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {line.lineType === "bundle" ? "Bundle" : "SKU"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{line.itemCode}</td>
                    <td className="px-4 py-2.5 text-gray-600">{itemName}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums font-medium">{line.qty}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{line.notes ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reserved components (after deposit paid) */}
      {record.movements.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Reserved components</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-600">SKU</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Location</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Reserved</th>
                </tr>
              </thead>
              <tbody>
                {record.movements.map((mov) => (
                  <tr key={mov.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{mov.product.sku}</td>
                    <td className="px-4 py-2 text-gray-700">{mov.product.name}</td>
                    <td className="px-4 py-2 text-gray-500">{mov.location.name}</td>
                    <td
                      className={cn(
                        "px-4 py-2 text-center tabular-nums font-medium",
                        mov.reservedQty > 0 ? "text-orange-600" : "text-gray-400 line-through"
                      )}
                    >
                      {mov.reservedQty > 0 ? mov.reservedQty : "released"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
