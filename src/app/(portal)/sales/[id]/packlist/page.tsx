import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "@/components/sales/print-button";
import { buildFulfillmentView } from "@/lib/sales-fulfillment-view";
import { formatAltGroupLabel } from "@/lib/alt-group-fulfillment";

export default async function PacklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) notFound();

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
  if (record.status === "quote" || record.status === "cancelled") notFound();

  const lineBundles = record.lines.filter((l) => l.lineType === "bundle").map((l) => l.itemCode);
  const bundleDefs =
    lineBundles.length > 0
      ? await prisma.bundleDefinition.findMany({
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
      : [];

  const liveBundles = Object.fromEntries(
    bundleDefs.map((b) => [
      b.code,
      {
        name: b.name,
        items: b.items.map((i) => ({ sku: i.product.sku, name: i.product.name, qty: i.qty })),
      },
    ])
  );

  const deductions =
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
    liveBundles,
    deductions,
  });

  const unresolved = view.altGroupTasks.filter((t) => !t.resolved);
  const printedAt = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const dateStr = record.date.toLocaleDateString("en-AU", { timeZone: "UTC" });

  return (
    <div className="packlist mx-auto max-w-3xl">
      <div className="print:hidden mb-6 flex items-center justify-between gap-3">
        <Link href={`/sales/${record.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {record.recordId}
        </Link>
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-gray-300 pb-4">
        <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Pack list</p>
        <h1 className="mt-1 font-mono text-2xl font-bold text-gray-900">{record.recordId}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
          <div>
            <dt className="text-xs text-gray-500">Customer</dt>
            <dd>{record.customer}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Date</dt>
            <dd>{dateStr}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Location</dt>
            <dd>{record.location.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Invoice / Quote</dt>
            <dd>{record.invoiceNo || record.quoteNo || "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-gray-500">
          Printed: {printedAt} (Brisbane) — reprint if fulfillment changes
        </p>
      </header>

      {unresolved.length > 0 && (
        <div className="mb-4 border border-amber-400 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-900">Pick one before completing</p>
          {unresolved.map((task) => (
            <p key={`${task.lineId}:${task.altGroupKey}`} className="mt-1 text-amber-800">
              Line {task.lineNo} · {formatAltGroupLabel(task.altGroupKey)} ×{task.requiredQty}:{" "}
              {task.candidates.map((c) => c.sku).join(" / ")}
            </p>
          ))}
        </div>
      )}

      {view.packlistRows.length === 0 ? (
        <p className="text-sm text-gray-500">No fulfillment rows to pick.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-900 text-left">
              <th className="w-8 py-2">✓</th>
              <th className="py-2">SKU</th>
              <th className="py-2">Name</th>
              <th className="py-2 text-center">Qty</th>
            </tr>
          </thead>
          <tbody>
            {view.packlistRows.map((row) => (
              <tr key={row.id} className="border-b border-gray-200">
                <td className="py-2.5">
                  <span className="inline-block h-4 w-4 border border-gray-700" />
                </td>
                <td className="py-2.5 font-mono text-xs">{row.sku}</td>
                <td className="py-2.5">{row.name}</td>
                <td className="py-2.5 text-center tabular-nums font-medium">{row.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="mt-8 border-t border-gray-300 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase">Notes</p>
        <div className="mt-2 h-24 border border-dashed border-gray-300" />
      </section>
    </div>
  );
}
