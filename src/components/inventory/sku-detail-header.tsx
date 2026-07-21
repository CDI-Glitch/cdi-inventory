"use client";

import { useState } from "react";
import ReorderPointEditor from "@/components/inventory/reorder-point-editor";
import InlineAdjustPanel from "@/components/inventory/inline-adjust-panel";
import { cn } from "@/lib/utils";

interface StockEntry {
  location: { id: string; name: string };
  stock: { onHand: number; reserved: number; available: number };
}

interface Props {
  sku: string;
  productId: string;
  name: string;
  category: string;
  unit: string;
  adminNotes: string | null;
  reorderPoint: number;
  stockByLocation: StockEntry[];
  locations: { id: string; name: string }[];
  canAdjust: boolean;
}

export default function SKUDetailHeader({
  sku,
  productId,
  name,
  category,
  unit,
  adminNotes,
  reorderPoint,
  stockByLocation,
  locations,
  canAdjust,
}: Props) {
  const [adjustOpen, setAdjustOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{sku}</h1>
          <p className="text-gray-600 mt-0.5">{name}</p>
          <p className="text-sm text-gray-400 mt-1">
            {category.replace(/_/g, " ")} · {unit}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {adminNotes && (
            <p className="text-sm text-gray-500 max-w-xs text-right">{adminNotes}</p>
          )}
          {canAdjust && (
            <button
              onClick={() => setAdjustOpen((v) => !v)}
              className={cn(
                "rounded border px-3 py-1.5 text-sm font-medium transition-colors",
                adjustOpen
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              {adjustOpen ? "Cancel" : "Adjust Stock"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
        <span className="text-sm text-gray-500">Reorder point:</span>
        <ReorderPointEditor sku={sku} initialValue={reorderPoint} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {stockByLocation.map(({ location, stock }) => (
          <div key={location.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {location.name}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400">On Hand</p>
                <p className="text-lg font-bold text-gray-900">{stock.onHand}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Reserved</p>
                <p className={cn("text-lg font-bold", stock.reserved > 0 ? "text-orange-600" : "text-gray-900")}>
                  {stock.reserved}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Available</p>
                <p className={cn("text-lg font-bold", stock.available <= 0 ? "text-red-600" : "text-green-700")}>
                  {stock.available}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {adjustOpen && (
        <InlineAdjustPanel
          productId={productId}
          locations={locations}
          onClose={() => setAdjustOpen(false)}
        />
      )}
    </div>
  );
}
