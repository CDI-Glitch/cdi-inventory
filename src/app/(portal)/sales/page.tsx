import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SalesFilters } from "@/components/sales/sales-filters";
import { LocationTabs } from "@/components/ui/location-tabs";

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

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; loc?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userName = (session?.user as any)?.name ?? "";
  const params = await searchParams;

  const locations = await prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  // Default tab: editor → their own warehouse, admin/viewer → All
  const activeLoc =
    params.loc !== undefined
      ? params.loc
      : role === "editor"
      ? (locations.find((l) => l.name.toLowerCase() === userName.toLowerCase())?.name ?? "")
      : "";

  const activeLocation = activeLoc ? locations.find((l) => l.name === activeLoc) : null;

  const records = await prisma.salesRecord.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(activeLocation ? { locationId: activeLocation.id } : {}),
      ...(params.search
        ? {
            OR: [
              { customer: { contains: params.search, mode: "insensitive" } },
              { recordId: { contains: params.search, mode: "insensitive" } },
              { invoiceNo: { contains: params.search, mode: "insensitive" } },
              { quoteNo: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      location: true,
      lines: { orderBy: { sortOrder: "asc" }, take: 2 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
        {role !== "viewer" && (
          <Link
            href="/sales/new"
            className="rounded-md bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]"
          >
            + New record
          </Link>
        )}
      </div>

      {/* Location tabs */}
      <LocationTabs locations={locations} current={activeLoc} />

      <SalesFilters defaultSearch={params.search} defaultStatus={params.status} currentLoc={activeLoc} />

      {records.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          No sales records found.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Record</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Items</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Location</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/sales/${rec.id}`} className="font-mono text-[#2563EB] hover:underline">
                      {rec.recordId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(rec.date).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{rec.customer}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {(() => {
                      const first = rec.lines[0];
                      if (!first) return <span className="text-gray-400">—</span>;
                      return (
                        <>
                          <span>{first.itemCode}</span>
                          {rec.lines.length > 1 && (
                            <span className="ml-1.5 text-gray-400">+{rec.lines.length - 1}</span>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{rec.location.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[rec.status])}>
                      {STATUS_LABELS[rec.status]}
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
