import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { IncomingStatusActions } from "@/components/incoming/incoming-status-actions";
import { IncomingLinesEditor } from "@/components/incoming/incoming-lines-editor";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  shipped: "bg-blue-100 text-blue-700",
  in_transit: "bg-yellow-100 text-yellow-700",
  arrived: "bg-orange-100 text-orange-700",
  confirmed: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  shipped: "Shipped",
  in_transit: "In transit",
  arrived: "Arrived",
  confirmed: "Confirmed",
};

export default async function IncomingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === "viewer") redirect("/dashboard");

  const { id } = await params;

  const shipment = await prisma.incomingShipment.findUnique({
    where: { id },
    include: {
      location: true,
      lines: { include: { product: true }, orderBy: { id: "asc" } },
    },
  });

  if (!shipment) notFound();

  const canEditLines = ["in_transit", "arrived"].includes(shipment.status);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/incoming" className="text-sm text-gray-500 hover:text-gray-700">
          ← Incoming
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono font-semibold text-gray-900">{shipment.poRef}</span>
      </div>

      <div className="grid gap-6">
        {/* Header card */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{shipment.supplierName}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {shipment.poRef}
                {shipment.poNumber && ` · ${shipment.poNumber}`}
                {" · "}
                {shipment.location.name}
              </p>
            </div>
            <span className={cn(
              "rounded-full px-3 py-1 text-sm font-medium",
              STATUS_STYLES[shipment.status] ?? "bg-gray-100 text-gray-500"
            )}>
              {STATUS_LABELS[shipment.status] ?? shipment.status}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">ETA</span>
              <p className="font-medium text-gray-900 mt-0.5">
                {shipment.eta ? new Date(shipment.eta).toLocaleDateString("en-AU") : "Not set"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Created</span>
              <p className="font-medium text-gray-900 mt-0.5">
                {new Date(shipment.createdAt).toLocaleDateString("en-AU")}
              </p>
            </div>
            {shipment.notes && (
              <div>
                <span className="text-gray-500">Notes</span>
                <p className="font-medium text-gray-900 mt-0.5">{shipment.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Status actions */}
        {shipment.status !== "confirmed" && (
          <IncomingStatusActions
            id={shipment.id}
            currentStatus={shipment.status}
          />
        )}

        {/* Lines */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Lines ({shipment.lines.length})</h2>
          </div>
          {canEditLines ? (
            <IncomingLinesEditor
              shipmentId={shipment.id}
              lines={shipment.lines.map((l) => ({
                id: l.id,
                sku: l.product.sku,
                name: l.product.name,
                qtyOrdered: l.qtyOrdered,
                qtyReceived: l.qtyReceived,
                unitCost: (l.unitCost as number | null),
                notes: l.notes ?? "",
              }))}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-600">SKU</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Ordered</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Received</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {shipment.lines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-mono text-blue-600">{line.product.sku}</td>
                    <td className="px-4 py-2 text-gray-900">{line.product.name}</td>
                    <td className="px-4 py-2 text-right">{line.qtyOrdered}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={line.qtyReceived < line.qtyOrdered ? "text-orange-600" : "text-green-600"}>
                        {line.qtyReceived}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{line.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
