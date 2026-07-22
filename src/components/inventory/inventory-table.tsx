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

// SKU grows | Name grows | Category grows | On Hand | Reserved | Available | Status
const COLS =
  "grid-cols-[minmax(9rem,1fr)_minmax(12rem,2fr)_minmax(8rem,1fr)_5.5rem_5.5rem_5.5rem_7.5rem]";

const cell = "px-3 py-2.5 text-sm min-w-0";
const cellCenter = cn(cell, "text-center tabular-nums");
const headerCell = cn(cell, "font-medium text-gray-600 whitespace-nowrap");
const headerCellCenter = cn(cellCenter, "font-medium text-gray-600 whitespace-nowrap");

export function InventoryTable({
  rows,
  locationName,
}: {
  rows: StockRow[];
  locationName: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white p-12 text-sm text-gray-500">
        No products found. Add a SKU to get started.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Pinned column header */}
      <div className={cn("grid shrink-0 items-center border-b border-gray-200 bg-gray-50", COLS)}>
        <div className={headerCell}>SKU</div>
        <div className={headerCell}>Name</div>
        <div className={headerCell}>Category</div>
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
              className={cn("grid items-center border-b border-gray-100 hover:bg-gray-50", COLS)}
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
