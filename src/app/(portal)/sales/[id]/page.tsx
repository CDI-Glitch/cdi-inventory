import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SalesStatusActions } from "@/components/sales/sales-status-actions";
import { SalesHeaderEditor } from "@/components/sales/sales-header-editor";
import { SalesLinesEditor } from "@/components/sales/sales-lines-editor";
import { SalesMovementsEditor } from "@/components/sales/sales-movements-editor";
import { SalesAltGroupPicker } from "@/components/sales/sales-alt-group-picker";
import { BundleOrderLineRow } from "@/components/sales/bundle-order-line-row";
import { asRole, canEditFulfillment as fulfillmentEditable, canEditSalesRecord } from "@/lib/permissions";
import { unresolvedAltGroupSummary } from "@/lib/alt-group-fulfillment";
import {
  buildFulfillmentView,
  getBundleComponents,
  isSkuMismatch,
} from "@/lib/sales-fulfillment-view";

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
  const role = asRole((session?.user as any)?.role);
  const { id } = await params;

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

  const isQuote = record.status === "quote";
  const canEditHeader = canEditSalesRecord(role) && isQuote;
  const canEditLines = canEditSalesRecord(role) && isQuote;
  const canEditFulfillment = fulfillmentEditable(role, record.status);
  const hasFulfillment = record.movements.some((m) => m.reservedQty > 0);
  const showFulfillmentSection =
    record.status !== "quote" && record.status !== "cancelled";

  // Resolve item names for lines
  const lineSkus = record.lines.filter((l) => l.lineType === "sku").map((l) => l.itemCode);
  const lineBundles = record.lines.filter((l) => l.lineType === "bundle").map((l) => l.itemCode);

  const [skuProducts, bundleDefs, allLocations, allProducts, rawBundles] = await Promise.all([
    lineSkus.length > 0
      ? prisma.product.findMany({
          where: { sku: { in: lineSkus } },
          select: { sku: true, name: true, unit: true },
        })
      : Promise.resolve([]),
    lineBundles.length > 0
      ? prisma.bundleDefinition.findMany({
          where: { code: { in: lineBundles } },
          select: {
            code: true,
            name: true,
            items: {
              select: { qty: true, product: { select: { sku: true, name: true } } },
              orderBy: { sortOrder: "asc" },
            },
          },
        })
      : Promise.resolve([]),
    canEditHeader ? prisma.location.findMany({ where: { active: true } }) : Promise.resolve([]),
    canEditLines || canEditFulfillment
      ? // CONSUMABLE items (bulk hardware, manually deducted) are not sellable sales lines
        prisma.product.findMany({
          where: { active: true, category: { not: "CONSUMABLE" } },
          orderBy: { sku: "asc" },
          select: { sku: true, name: true, category: true },
        })
      : Promise.resolve([]),
    canEditLines
      ? prisma.bundleDefinition.findMany({
          where: { active: true },
          orderBy: { code: "asc" },
          include: {
            items: { include: { product: true }, orderBy: { sortOrder: "asc" } },
          },
        })
      : Promise.resolve([]),
  ]);

  const skuMap = Object.fromEntries(skuProducts.map((p) => [p.sku, p]));
  const bundleMap = Object.fromEntries(
    bundleDefs.map((b: any) => [
      b.code,
      {
        name: b.name,
        items: b.items.map((i: any) => ({ sku: i.product.sku, name: i.product.name, qty: i.qty })),
      },
    ])
  );

  const bundlesForEditor = rawBundles.map((b: any) => ({
    code: b.code,
    name: b.name,
    items: b.items.map((i: any) => ({ sku: i.product.sku, name: i.product.name, qty: i.qty })),
  }));

  const dateStr = record.date.toISOString().slice(0, 10);

  const completedDeductions =
    record.status === "completed"
      ? await prisma.inventoryLog.findMany({
          where: { reference: record.recordId, type: "sales_deduction" },
          include: { product: true, location: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

  const view = buildFulfillmentView({
    status: record.status,
    lines: record.lines,
    movements: record.movements,
    liveBundles: bundleMap,
    deductions: completedDeductions,
  });
  const {
    orderLineMap,
    fulfillmentRows,
    deductionRows,
    altGroupTasks,
    hasAnyFulfillmentMismatch,
    hasAnyDeductionMismatch,
  } = view;
  const completeBlockedReason =
    record.status === "fully_paid" ? unresolvedAltGroupSummary(altGroupTasks) : null;

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
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
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              STATUS_STYLES[record.status]
            )}
          >
            {STATUS_LABELS[record.status]}
          </span>
          {isQuote && (
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
          isQuote={canEditHeader}
        />
      </div>

      {/* Status actions */}
      {canEditSalesRecord(role) && (
        <SalesStatusActions
          id={record.id}
          currentStatus={record.status}
          version={record.version}
          completeBlockedReason={completeBlockedReason}
        />
      )}

      {/* ── Table 1: Order lines (客户订的) ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              Order lines{" "}
              <span className="text-gray-400 font-normal">({record.lines.length})</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Customer order — Invoice basis</p>
          </div>
          {canEditLines && (
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

                if (line.lineType === "bundle") {
                  return (
                    <BundleOrderLineRow
                      key={line.id}
                      idx={idx + 1}
                      itemCode={line.itemCode}
                      itemName={itemName}
                      qty={line.qty}
                      notes={line.notes}
                      components={getBundleComponents(line, bundleMap)}
                    />
                  );
                }

                // lineType === "sku" from here on (bundle lines returned above)
                return (
                  <tr key={line.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                        SKU
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                      {line.itemCode}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{itemName}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums font-medium">
                      {line.qty}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {line.notes ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Table 2: Fulfillment (实际发货) ── */}
      {showFulfillmentSection && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Fulfillment</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {record.status === "completed"
                  ? "Actual stock deducted at completion"
                  : "Actual stock reserved / to be pulled — source of truth for deduction"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/sales/${record.id}/packlist`}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                Print pack list
              </Link>
              {canEditFulfillment && (
                <SalesMovementsEditor
                  salesRecordId={record.id}
                  existingMovements={record.movements}
                  skuOptions={allProducts}
                />
              )}
            </div>
          </div>

          {record.status !== "completed" && (
            <SalesAltGroupPicker
              salesRecordId={record.id}
              tasks={altGroupTasks}
              canEdit={canEditFulfillment}
            />
          )}

          {record.status === "completed" ? (
            // Completed: show what was actually deducted from InventoryLog
            deductionRows.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
                No deduction records found.
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2 text-left font-medium text-gray-600">SKU</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Location</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Deducted</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {deductionRows.map((row) => {
                      const orderedQty = orderLineMap[row.sku];
                      const mismatch = isSkuMismatch(orderLineMap, row.sku, row.qty);
                      return (
                        <tr key={row.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-2 font-mono text-xs text-gray-700">
                            {row.sku}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{row.name}</td>
                          <td className="px-4 py-2 text-gray-500">{row.locationName}</td>
                          <td className="px-4 py-2 text-center tabular-nums font-medium text-gray-500">
                            {row.qty}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {mismatch && (
                              <span
                                title={
                                  orderedQty === undefined
                                    ? "SKU not in order lines (substituted)"
                                    : `Order qty: ${orderedQty}, deducted: ${row.qty}`
                                }
                                className="text-amber-500 text-xs font-semibold cursor-help"
                              >
                                ⚠
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {hasAnyDeductionMismatch && (
                  <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                    ⚠ Some deducted items differ from the order lines — substitutions were made.
                  </div>
                )}
              </div>
            )
          ) : (
            // Active (deposit_paid / fully_paid): show live GeneratedMovement (aggregated by SKU)
            !hasFulfillment ? (
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
                No active reservations.
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2 text-left font-medium text-gray-600">SKU</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Location</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Reserved</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {fulfillmentRows.map((row) => {
                      const orderedQty = orderLineMap[row.sku];
                      const mismatch = isSkuMismatch(orderLineMap, row.sku, row.qty);
                      return (
                        <tr key={row.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-2 font-mono text-xs text-gray-700">
                            {row.sku}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{row.name}</td>
                          <td className="px-4 py-2 text-gray-500">{row.locationName}</td>
                          <td className="px-4 py-2 text-center tabular-nums font-medium text-orange-600">
                            {row.qty}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {mismatch && (
                              <span
                                title={
                                  orderedQty === undefined
                                    ? "SKU not in order lines (substituted)"
                                    : `Order qty: ${orderedQty}, fulfillment qty: ${row.qty}`
                                }
                                className="text-amber-500 text-xs font-semibold cursor-help"
                              >
                                ⚠
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {hasAnyFulfillmentMismatch && (
                  <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                    ⚠ Some fulfillment rows differ from the order lines — substitutions were made.
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
