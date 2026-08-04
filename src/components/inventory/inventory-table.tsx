"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface StockRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  byLocation: Record<string, { onHand: number; reserved: number; available: number }>;
  totalAvailable: number;
  status: "OK" | "REORDER" | "OUT_OF_STOCK";
  /** Qty arriving in each forecast column, 0 if this SKU has no line in that container */
  forecastQtys?: number[];
  /** Cumulative Future Available as of each forecast column (onHand − reserved + Σ qty) */
  forecastAvailable?: number[];
}

interface ForecastContainer {
  id: string;
  poRef: string;
  eta: string;
}

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

const cell = "px-3 py-2.5 text-sm min-w-0";
const cellCenter = cn(cell, "text-center tabular-nums");
const headerCell = cn(cell, "font-medium text-gray-600 whitespace-nowrap");
const headerCellCenter = cn(cellCenter, "font-medium text-gray-600 whitespace-nowrap");

// Fixed-width tail shared by both modes: On Hand | Reserved | Available | Status
const TAIL_COLS = ["5.5rem", "5.5rem", "5.5rem", "7.5rem"];

function buildGridTemplate(forecast: boolean, containerCount: number) {
  const cols = ["minmax(9rem,1fr)"]; // SKU
  if (!forecast) cols.push("minmax(12rem,2fr)"); // Name (hidden in forecast mode)
  cols.push("minmax(8rem,1fr)"); // Category
  if (forecast) {
    for (let i = 0; i < containerCount; i++) cols.push("7.5rem");
  }
  cols.push(...TAIL_COLS);
  return cols.join(" ");
}

export function InventoryTable({
  rows,
  locationName,
  forecast = false,
  containers = [],
  canLinkContainers = false,
}: {
  rows: StockRow[];
  locationName: string;
  forecast?: boolean;
  containers?: ForecastContainer[];
  canLinkContainers?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white p-12 text-sm text-gray-500">
        No products found. Add a SKU to get started.
      </div>
    );
  }

  const gridTemplateColumns = buildGridTemplate(forecast, containers.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      {forecast && containers.length === 0 && (
        <div className="shrink-0 border-b border-gray-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          No upcoming shipments in transit for {locationName}. Future Available currently equals
          today&apos;s Available.
        </div>
      )}

      {/* Pinned column header */}
      <div
        className="grid shrink-0 items-center border-b border-gray-200 bg-gray-50"
        style={{ gridTemplateColumns }}
      >
        <div className={headerCell}>SKU</div>
        {!forecast && <div className={headerCell}>Name</div>}
        <div className={headerCell}>Category</div>
        {forecast &&
          containers.map((c, i) => (
            <div key={c.id} className={cn(headerCellCenter, "leading-tight")}>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Next {i + 1}</div>
              {canLinkContainers ? (
                <Link
                  href={`/incoming/${c.id}`}
                  className="font-mono text-xs text-[#2563EB] hover:underline"
                >
                  {c.poRef}
                </Link>
              ) : (
                <span className="font-mono text-xs text-gray-700">{c.poRef}</span>
              )}
              <div className="text-[10px] text-gray-400">{formatEta(c.eta)}</div>
            </div>
          ))}
        <div className={headerCellCenter}>On Hand</div>
        <div className={headerCellCenter}>Reserved</div>
        <div className={headerCellCenter}>Available</div>
        <div className={headerCellCenter}>Status</div>
      </div>

      {/* Scrollable rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row) => {
          const s = row.byLocation[locationName] ?? { onHand: 0, reserved: 0, available: 0 };
          return (
            <div
              key={row.id}
              className="grid items-center border-b border-gray-100 hover:bg-gray-50"
              style={{ gridTemplateColumns }}
            >
              <div className={cn(cell, "font-mono")}>
                <Link
                  href={`/inventory/${row.sku}`}
                  className="text-[#2563EB] hover:underline"
                >
                  {row.sku}
                </Link>
              </div>
              {!forecast && (
                <div className={cn(cell, "truncate text-gray-900")} title={row.name}>
                  {row.name}
                </div>
              )}
              <div className={cn(cell, "truncate text-gray-500")}>
                {formatCategory(row.category)}
              </div>
              {forecast &&
                containers.map((c, i) => {
                  const qty = row.forecastQtys?.[i] ?? 0;
                  const avail = row.forecastAvailable?.[i] ?? s.available;
                  return (
                    <div key={c.id} className={cn(cellCenter, "leading-tight")}>
                      <div className={qty > 0 ? "font-medium text-green-700" : "text-gray-300"}>
                        {qty > 0 ? `+${qty}` : "—"}
                      </div>
                      <div className={cn("text-[11px]", avail <= 0 ? "text-red-500" : "text-gray-400")}>
                        Avail {avail}
                      </div>
                    </div>
                  );
                })}
              <div className={cellCenter}>{s.onHand}</div>
              <div className={cn(cellCenter, "text-orange-600")}>
                {s.reserved > 0 ? s.reserved : "—"}
              </div>
              <div
                className={cn(
                  cellCenter,
                  "font-medium",
                  s.available <= 0 ? "text-red-600" : "text-gray-900"
                )}
              >
                {s.available}
              </div>
              <div className={cn(cellCenter, "flex justify-center")}>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                    STATUS_STYLES[row.status]
                  )}
                >
                  {STATUS_LABELS[row.status]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
