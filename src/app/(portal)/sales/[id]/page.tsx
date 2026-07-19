import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SalesStatusActions } from "@/components/sales/sales-status-actions";

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

  const record = await prisma.salesRecord.findUnique({
    where: { id },
    include: {
      location: true,
      movements: {
        include: { product: true, location: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!record) notFound();

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
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{record.recordId}</h1>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[record.status])}>
                {STATUS_LABELS[record.status]}
              </span>
            </div>
            <p className="text-gray-600 mt-1">{record.customer}</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>{new Date(record.date).toLocaleDateString("en-AU")}</p>
            <p>{record.location.name}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-gray-500 w-24">Item</span>
            <span className="font-mono font-medium">{record.itemCode}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24">Type</span>
            <span className="capitalize">{record.saleType}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24">Qty</span>
            <span>{record.qty}</span>
          </div>
          {record.invoiceNo && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-24">Invoice</span>
              <span>{record.invoiceNo}</span>
            </div>
          )}
          {record.orderNo && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-24">Order</span>
              <span>{record.orderNo}</span>
            </div>
          )}
        </div>

        {record.staffNotes && (
          <div className="mt-3 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
            {record.staffNotes}
          </div>
        )}
      </div>

      {/* Status actions */}
      {role !== "viewer" && (
        <SalesStatusActions
          id={record.id}
          currentStatus={record.status}
          version={record.version}
        />
      )}

      {/* Generated movements (reserved components) */}
      {record.movements.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Reserved components
          </h2>
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
                  <tr key={mov.id} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-mono text-xs">{mov.product.sku}</td>
                    <td className="px-4 py-2 text-gray-700">{mov.product.name}</td>
                    <td className="px-4 py-2 text-gray-500">{mov.location.name}</td>
                    <td className={cn("px-4 py-2 text-center tabular-nums font-medium",
                      mov.reservedQty > 0 ? "text-orange-600" : "text-gray-400 line-through"
                    )}>
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
