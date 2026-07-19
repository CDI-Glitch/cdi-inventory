import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

export default async function IncomingPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === "viewer") redirect("/dashboard");

  const shipments = await prisma.incomingShipment.findMany({
    include: { location: true, lines: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Incoming shipments</h1>
        <Link
          href="/incoming/new"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New shipment
        </Link>
      </div>

      {shipments.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          No incoming shipments yet.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">PO ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">PO number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Destination</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ETA</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Lines</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/incoming/${s.id}`} className="font-mono text-blue-600 hover:underline">
                      {s.poRef}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{s.supplierName}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{s.poNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.location.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.eta ? new Date(s.eta).toLocaleDateString("en-AU") : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">{s.lines.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"
                    )}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
