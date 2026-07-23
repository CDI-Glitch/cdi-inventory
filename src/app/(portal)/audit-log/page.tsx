import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { INVENTORY_LOG_TYPES } from "@/lib/constants";
import { AuditFilters } from "@/components/audit/audit-filters";

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<string, string> = {
  opening_stock: "Opening Stock",
  receive_stock: "Receive Stock",
  sales_deduction: "Sales Deduction",
  adjustment_in: "Adjustment In",
  adjustment_out: "Adjustment Out",
  write_off: "Write Off",
  stocktake_correction: "Stocktake Correction",
  transfer_out: "Transfer Out",
  transfer_in: "Transfer In",
  reservation_adjustment: "Reservation Adjusted",
};

const TYPE_STYLES: Record<string, string> = {
  opening_stock: "bg-gray-100 text-gray-600",
  receive_stock: "bg-green-50 text-green-700",
  sales_deduction: "bg-orange-50 text-orange-700",
  adjustment_in: "bg-blue-50 text-[#1D4ED8]",
  adjustment_out: "bg-red-50 text-red-700",
  write_off: "bg-red-100 text-red-800",
  stocktake_correction: "bg-purple-50 text-purple-700",
  transfer_out: "bg-yellow-50 text-yellow-700",
  transfer_in: "bg-teal-50 text-teal-700",
  reservation_adjustment: "bg-indigo-50 text-indigo-700",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    sku?: string;
    location?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as any)?.role;
  if (role !== "admin" && role !== "editor") redirect("/dashboard");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));

  const where: any = {};
  if (params.type) where.type = params.type;
  if (params.sku) {
    where.product = { sku: { contains: params.sku, mode: "insensitive" } };
  }
  if (params.location) where.locationId = params.location;
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = new Date(params.from);
    if (params.to) {
      const to = new Date(params.to);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  const [logs, total, locations] = await Promise.all([
    prisma.inventoryLog.findMany({
      where,
      include: {
        product: { select: { sku: true, name: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.inventoryLog.count({ where }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  // Resolve enteredBy (user cuid / special tokens) → display name
  const enteredByIds = [...new Set(logs.map((l) => l.enteredBy).filter(Boolean))];
  const users =
    enteredByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: enteredByIds } },
          select: { id: true, name: true },
        })
      : [];
  const userNameMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  function displayEnteredBy(enteredBy: string) {
    if (userNameMap[enteredBy]) return userNameMap[enteredBy];
    // Known system tokens (import scripts, etc.)
    if (enteredBy === "import" || enteredBy === "system") return enteredBy;
    return enteredBy; // fallback: show raw id if user deleted
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Complete inventory movement history — {total.toLocaleString()} records
        </p>
      </div>

      {/* Filters */}
      <AuditFilters
        defaultSku={params.sku}
        defaultType={params.type}
        defaultLocation={params.location}
        defaultFrom={params.from}
        defaultTo={params.to}
        locations={locations}
      />

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Type</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Delta</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Reference</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">By</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                  No records found
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {new Date(log.createdAt).toLocaleString("en-AU", {
                    day: "2-digit", month: "short", year: "2-digit",
                    hour: "2-digit", minute: "2-digit", hour12: false,
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{log.product.sku}</span>
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{log.product.name}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{log.location.name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[log.type] ?? "bg-gray-100 text-gray-600"}`}>
                    {TYPE_LABELS[log.type] ?? log.type}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${log.delta > 0 ? "text-green-600" : "text-red-500"}`}>
                  {log.delta > 0 ? "+" : ""}{log.delta}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{log.reference ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{displayEnteredBy(log.enteredBy)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{log.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
