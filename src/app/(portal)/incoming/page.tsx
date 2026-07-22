import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { LocationTabs } from "@/components/ui/location-tabs";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  shipped: "bg-blue-100 text-[#1D4ED8]",
  in_transit: "bg-yellow-100 text-yellow-700",
  arrived: "bg-orange-100 text-orange-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  shipped: "Shipped",
  in_transit: "In transit",
  arrived: "Arrived",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

// Grid column template — matches header + row cells
const COLS =
  "grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.5fr)_minmax(7rem,1fr)_minmax(8rem,1fr)_7rem_4rem_7rem]";

export default async function IncomingPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === "viewer") redirect("/dashboard");

  const params = await searchParams;

  const locations = await prisma.location.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  // "all" = no location filter; otherwise filter by name
  const selectedLoc = params.loc ?? "all";
  const activeLocation =
    selectedLoc === "all"
      ? null
      : locations.find((l) => l.name === selectedLoc) ?? null;

  const shipments = await prisma.incomingShipment.findMany({
    where: activeLocation ? { locationId: activeLocation.id } : undefined,
    include: { location: true, lines: true },
    orderBy: { createdAt: "desc" },
  });


  const headerCell = "px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const headerCellCenter = "px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide";

  return (
    <div className="-m-8 flex h-screen flex-col">
      {/* Fixed header zone */}
      <div className="shrink-0 bg-white px-8 pt-8 pb-0">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Incoming shipments</h1>
          <Link
            href="/incoming/new"
            className="rounded-md bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]"
          >
            + New shipment
          </Link>
        </div>

        {/* Location tabs — Suspense required because LocationTabs uses useSearchParams */}
        <Suspense fallback={null}>
          <LocationTabs locations={locations} current={selectedLoc} showAll />
        </Suspense>
      </div>

      {/* Scrollable table zone */}
      <div className="mx-8 flex min-h-0 flex-1 flex-col mb-8">
        {shipments.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 mt-4">
            No incoming shipments{selectedLoc !== "all" ? ` for ${selectedLoc}` : ""}.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
            {/* Pinned header */}
            <div className={cn("grid shrink-0 items-center border-b border-gray-200 bg-gray-50", COLS)}>
              <div className={headerCell}>PO ref</div>
              <div className={headerCell}>Supplier</div>
              <div className={headerCell}>PO number</div>
              <div className={headerCell}>Destination</div>
              <div className={headerCell}>ETA</div>
              <div className={headerCellCenter}>Lines</div>
              <div className={headerCellCenter}>Status</div>
            </div>

            {/* Scrollable rows */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {shipments.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "grid items-center border-b border-gray-100 last:border-0 hover:bg-gray-50",
                    COLS
                  )}
                >
                  <div className="px-4 py-3">
                    <Link
                      href={`/incoming/${s.id}`}
                      className="font-mono text-sm text-[#2563EB] hover:underline"
                    >
                      {s.poRef}
                    </Link>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-900">{s.supplierName}</div>
                  <div className="px-4 py-3 text-sm text-gray-500 font-mono">
                    {s.poNumber ?? "—"}
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-500">{s.location.name}</div>
                  <div className="px-4 py-3 text-sm text-gray-500">
                    {s.eta ? new Date(s.eta).toLocaleDateString("en-AU") : "—"}
                  </div>
                  <div className="px-4 py-3 text-sm text-center">{s.lines.length}</div>
                  <div className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                        STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"
                      )}
                    >
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

