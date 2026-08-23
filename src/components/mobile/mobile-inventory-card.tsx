import type { InventoryRow, ForecastContainer } from "@/lib/inventory-view";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  OK: "bg-green-100 text-green-800",
  REORDER: "bg-yellow-100 text-yellow-800",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
};

const STATUS_LABELS = {
  OK: "OK",
  REORDER: "Reorder",
  OUT_OF_STOCK: "Out of stock",
};

function formatCategory(category: string) {
  if (category === "12V") return "12V";
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEta(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
}

export function MobileInventoryCard({
  row,
  locationName,
  forecast,
  containers,
}: {
  row: InventoryRow;
  locationName: string;
  forecast: boolean;
  containers: ForecastContainer[];
}) {
  const s = row.byLocation[locationName] ?? { onHand: 0, reserved: 0, available: 0 };

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-gray-900 break-all">{row.sku}</p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{row.name}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">{formatCategory(row.category)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            STATUS_STYLES[row.status]
          )}
        >
          {STATUS_LABELS[row.status]}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-400">On hand</dt>
          <dd className="text-sm tabular-nums text-gray-900">{s.onHand}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-400">Reserved</dt>
          <dd className="text-sm tabular-nums text-orange-600">{s.reserved > 0 ? s.reserved : "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-400">Available</dt>
          <dd
            className={cn(
              "text-sm font-semibold tabular-nums",
              s.available <= 0 ? "text-red-600" : "text-gray-900"
            )}
          >
            {s.available}
          </dd>
        </div>
      </dl>

      {forecast && containers.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-2">
          {containers.map((c, i) => {
            const qty = row.forecastQtys[i] ?? 0;
            const avail = row.forecastAvailable[i] ?? s.available;
            return (
              <li key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  <span className="font-mono text-gray-700">{c.poRef}</span>
                  {" · "}
                  {formatEta(c.eta)}
                </span>
                <span className="tabular-nums">
                  <span className={qty > 0 ? "font-medium text-green-700" : "text-gray-300"}>
                    {qty > 0 ? `+${qty}` : "—"}
                  </span>
                  <span className={cn("ml-2", avail <= 0 ? "text-red-500" : "text-gray-400")}>
                    Avail {avail}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
