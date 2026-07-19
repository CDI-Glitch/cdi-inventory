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

export function InventoryTable({
  rows,
  locationNames,
}: {
  rows: StockRow[];
  locationNames: string[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
        No products found. Add a SKU to get started.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
            {locationNames.map((loc) => (
              <th key={loc} className="px-4 py-3 text-center font-medium text-gray-600" colSpan={3}>
                {loc}
              </th>
            ))}
            <th className="px-4 py-3 text-center font-medium text-gray-600">Total Available</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
          </tr>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-400">
            <th colSpan={3} />
            {locationNames.map((loc) => (
              <React.Fragment key={loc}>
                <th className="px-2 py-1 text-center">On Hand</th>
                <th className="px-2 py-1 text-center">Reserved</th>
                <th className="px-2 py-1 text-center">Available</th>
              </React.Fragment>
            ))}
            <th />
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  href={`/inventory/${row.sku}`}
                  className="font-mono text-blue-600 hover:underline"
                >
                  {row.sku}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-900">{row.name}</td>
              <td className="px-4 py-3 text-gray-500">{row.category.replace(/_/g, " ")}</td>
              {locationNames.map((loc) => {
                const s = row.byLocation[loc] ?? { onHand: 0, reserved: 0, available: 0 };
                return (
                  <React.Fragment key={`${row.id}-${loc}`}>
                    <td className="px-2 py-3 text-center tabular-nums">{s.onHand}</td>
                    <td className="px-2 py-3 text-center tabular-nums text-orange-600">{s.reserved > 0 ? s.reserved : "—"}</td>
                    <td className={cn("px-2 py-3 text-center tabular-nums font-medium", s.available <= 0 ? "text-red-600" : "text-gray-900")}>{s.available}</td>
                  </React.Fragment>
                );
              })}
              <td className="px-4 py-3 text-center tabular-nums font-semibold">{row.totalAvailable}</td>
              <td className="px-4 py-3 text-center">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[row.status])}>
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
