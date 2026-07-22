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
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  status: "OK" | "REORDER" | "OUT_OF_STOCK";
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
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Fixed column tracks — header and rows share the same template so they align
const SINGLE_COLS =
  "grid-cols-[minmax(8.5rem,1.1fr)_minmax(11rem,2.2fr)_minmax(7.5rem,1fr)_4.5rem_4.5rem_4.5rem_6.5rem]";

function multiCols(locationCount: number) {
  // SKU | Name | Category | (OH R Av)×N | Total | Status
  const stockTracks = Array.from({ length: locationCount }, () => "3.5rem 3.5rem 3.5rem").join(" ");
  return `grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.8fr)_minmax(7rem,0.9fr)_${stockTracks}_4.5rem_6rem]`;
}

export function InventoryTable({
  rows,
  locationNames,
  singleLocation = false,
}: {
  rows: StockRow[];
  locationNames: string[];
  singleLocation?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white p-12 text-sm text-gray-500">
        No products found. Add a SKU to get started.
      </div>
    );
  }

  const cols = singleLocation ? SINGLE_COLS : multiCols(locationNames.length);
  const cell = "px-3 py-2.5 text-sm min-w-0";
  const cellCenter = cn(cell, "text-center tabular-nums");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Pinned column header — never scrolls */}
      <div className="shrink-0 border-b border-gray-200 bg-gray-50">
        {singleLocation ? (
          <div className={cn("grid items-center", cols)}>
            <div className={cn(cell, "font-medium text-gray-600")}>SKU</div>
            <div className={cn(cell, "font-medium text-gray-600")}>Name</div>
            <div className={cn(cell, "font-medium text-gray-600")}>Category</div>
            <div className={cn(cellCenter, "font-medium text-gray-600")}>On Hand</div>
            <div className={cn(cellCenter, "font-medium text-gray-600")}>Reserved</div>
            <div className={cn(cellCenter, "font-medium text-gray-600")}>Available</div>
            <div className={cn(cellCenter, "font-medium text-gray-600")}>Status</div>
          </div>
        ) : (
          <>
            <div className={cn("grid items-center border-b border-gray-100", cols)}>
              <div className={cn(cell, "font-medium text-gray-600")}>SKU</div>
              <div className={cn(cell, "font-medium text-gray-600")}>Name</div>
              <div className={cn(cell, "font-medium text-gray-600")}>Category</div>
              {locationNames.map((loc) => (
                <div
                  key={loc}
                  className={cn(cellCenter, "col-span-3 font-medium text-gray-600")}
                >
                  {loc}
                </div>
              ))}
              <div className={cn(cellCenter, "font-medium text-gray-600")}>Total</div>
              <div className={cn(cellCenter, "font-medium text-gray-600")}>Status</div>
            </div>
            <div className={cn("grid items-center text-xs text-gray-400", cols)}>
              <div className="col-span-3" />
              {locationNames.map((loc) => (
                <div key={loc} className="contents">
                  <div className={cn(cellCenter, "py-1.5")}>On Hand</div>
                  <div className={cn(cellCenter, "py-1.5")}>Reserved</div>
                  <div className={cn(cellCenter, "py-1.5")}>Available</div>
                </div>
              ))}
              <div />
              <div />
            </div>
          </>
        )}
      </div>

      {/* Scrollable rows only */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              "grid items-center border-b border-gray-100 hover:bg-gray-50",
              cols
            )}
          >
            <div className={cn(cell, "font-mono")}>
              <Link
                href={`/inventory/${row.sku}`}
                className="text-[#2563EB] hover:underline"
              >
                {row.sku}
              </Link>
            </div>
            <div className={cn(cell, "truncate text-gray-900")} title={row.name}>
              {row.name}
            </div>
            <div className={cn(cell, "truncate text-gray-500")}>
              {formatCategory(row.category)}
            </div>

            {singleLocation ? (
              (() => {
                const s = row.byLocation[locationNames[0]] ?? {
                  onHand: 0,
                  reserved: 0,
                  available: 0,
                };
                return (
                  <>
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
                  </>
                );
              })()
            ) : (
              <>
                {locationNames.map((loc) => {
                  const s = row.byLocation[loc] ?? {
                    onHand: 0,
                    reserved: 0,
                    available: 0,
                  };
                  return (
                    <div key={`${row.id}-${loc}`} className="contents">
                      <div className={cn(cellCenter, "px-1")}>{s.onHand}</div>
                      <div className={cn(cellCenter, "px-1 text-orange-600")}>
                        {s.reserved > 0 ? s.reserved : "—"}
                      </div>
                      <div
                        className={cn(
                          cellCenter,
                          "px-1 font-medium",
                          s.available <= 0 ? "text-red-600" : "text-gray-900"
                        )}
                      >
                        {s.available}
                      </div>
                    </div>
                  );
                })}
                <div className={cn(cellCenter, "font-semibold")}>
                  {row.totalAvailable}
                </div>
              </>
            )}

            <div className={cn(cellCenter, "flex justify-center")}>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  STATUS_STYLES[row.status]
                )}
              >
                {STATUS_LABELS[row.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
