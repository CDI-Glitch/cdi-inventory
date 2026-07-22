"use client";

import React from "react";
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

const TH =
  "sticky z-10 bg-gray-50 px-4 py-3 text-left font-medium text-gray-600";
const TH_CENTER =
  "sticky z-10 bg-gray-50 px-4 py-3 text-center font-medium text-gray-600";
const TH_SUB =
  "sticky z-10 bg-gray-50 px-2 py-1 text-center font-medium text-gray-400";

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
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
        No products found. Add a SKU to get started.
      </div>
    );
  }

  // Primary header row sticks at top; secondary (multi-location) sticks below it
  const primaryTop = "top-0";
  const secondaryTop = "top-[45px]"; // matches primary row height (py-3 + text)

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className={cn(TH, primaryTop)}>SKU</th>
            <th className={cn(TH, primaryTop)}>Name</th>
            <th className={cn(TH, primaryTop)}>Category</th>
            {singleLocation ? (
              <>
                <th className={cn(TH_CENTER, primaryTop)}>On Hand</th>
                <th className={cn(TH_CENTER, primaryTop)}>Reserved</th>
                <th className={cn(TH_CENTER, primaryTop)}>Available</th>
              </>
            ) : (
              <>
                {locationNames.map((loc) => (
                  <th
                    key={loc}
                    className={cn(TH_CENTER, primaryTop)}
                    colSpan={3}
                  >
                    {loc}
                  </th>
                ))}
                <th className={cn(TH_CENTER, primaryTop)}>Total Available</th>
              </>
            )}
            <th className={cn(TH_CENTER, primaryTop)}>Status</th>
          </tr>
          {!singleLocation && (
            <tr className="border-b border-gray-200 text-xs">
              <th className={cn(TH_SUB, secondaryTop)} colSpan={3} />
              {locationNames.map((loc) => (
                <React.Fragment key={loc}>
                  <th className={cn(TH_SUB, secondaryTop)}>On Hand</th>
                  <th className={cn(TH_SUB, secondaryTop)}>Reserved</th>
                  <th className={cn(TH_SUB, secondaryTop)}>Available</th>
                </React.Fragment>
              ))}
              <th className={cn(TH_SUB, secondaryTop)} />
              <th className={cn(TH_SUB, secondaryTop)} />
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  href={`/inventory/${row.sku}`}
                  className="font-mono text-[#2563EB] hover:underline"
                >
                  {row.sku}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-900">{row.name}</td>
              <td className="px-4 py-3 text-gray-500">
                {row.category
                  .replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </td>
              {singleLocation ? (
                (() => {
                  const s = row.byLocation[locationNames[0]] ?? {
                    onHand: 0,
                    reserved: 0,
                    available: 0,
                  };
                  return (
                    <>
                      <td className="px-4 py-3 text-center tabular-nums">{s.onHand}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-orange-600">
                        {s.reserved > 0 ? s.reserved : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-center tabular-nums font-medium",
                          s.available <= 0 ? "text-red-600" : "text-gray-900"
                        )}
                      >
                        {s.available}
                      </td>
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
                      <React.Fragment key={`${row.id}-${loc}`}>
                        <td className="px-2 py-3 text-center tabular-nums">{s.onHand}</td>
                        <td className="px-2 py-3 text-center tabular-nums text-orange-600">
                          {s.reserved > 0 ? s.reserved : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-2 py-3 text-center tabular-nums font-medium",
                            s.available <= 0 ? "text-red-600" : "text-gray-900"
                          )}
                        >
                          {s.available}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-4 py-3 text-center tabular-nums font-semibold">
                    {row.totalAvailable}
                  </td>
                </>
              )}
              <td className="px-4 py-3 text-center">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_STYLES[row.status]
                  )}
                >
                  {STATUS_LABELS[row.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
