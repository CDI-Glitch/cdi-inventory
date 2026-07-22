"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SearchableSkuSelect } from "@/components/ui/searchable-sku-select";
import type { SkuOption } from "@/components/ui/searchable-sku-select";

interface MovementRow {
  id: string; // local key only
  sku: string;
  reservedQty: number;
}

interface ExistingMovement {
  id: string;
  product: { sku: string; name: string };
  reservedQty: number;
}

interface Props {
  salesRecordId: string;
  existingMovements: ExistingMovement[];
  skuOptions: SkuOption[];
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function SalesMovementsEditor({ salesRecordId, existingMovements, skuOptions }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toEditRows = (): MovementRow[] => {
    // Merge duplicate SKUs (legacy rows created before reserveStock aggregation)
    const merged: Record<string, number> = {};
    for (const m of existingMovements) {
      if (m.reservedQty > 0) {
        merged[m.product.sku] = (merged[m.product.sku] ?? 0) + m.reservedQty;
      }
    }
    return Object.entries(merged).map(([sku, reservedQty]) => ({
      id: uid(),
      sku,
      reservedQty,
    }));
  };

  const [rows, setRows] = useState<MovementRow[]>(toEditRows);

  function openEdit() {
    setRows(toEditRows());
    setError("");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError("");
  }

  const updateRow = useCallback((id: string, patch: Partial<MovementRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRow = () =>
    setRows((prev) => [...prev, { id: uid(), sku: "", reservedQty: 1 }]);

  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  async function save() {
    if (rows.some((r) => !r.sku || r.reservedQty < 0)) {
      setError("All rows must have a SKU and qty ≥ 0.");
      return;
    }
    // Deduplicate: if same SKU appears twice, sum qty
    const merged: Record<string, number> = {};
    for (const r of rows) {
      if (r.sku) merged[r.sku] = (merged[r.sku] ?? 0) + r.reservedQty;
    }
    const movements = Object.entries(merged).map(([sku, reservedQty]) => ({ sku, reservedQty }));

    setLoading(true);
    setError("");
    const res = await fetch(`/api/sales/${salesRecordId}/movements`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movements }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save fulfillment");
      setLoading(false);
      return;
    }
    setEditing(false);
    setLoading(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        onClick={openEdit}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Adjust fulfillment
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {rows.map((row, idx) => (
        <div key={row.id} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-5 text-right shrink-0">{idx + 1}</span>
          <div className="flex-1">
            <SearchableSkuSelect
              value={row.sku}
              options={skuOptions}
              placeholder="Select SKU"
              onChange={(val) => updateRow(row.id, { sku: val })}
              fullWidth
            />
          </div>
          <input
            type="number"
            min={0}
            value={row.reservedQty}
            onChange={(e) => updateRow(row.id, { reservedQty: Math.max(0, Number(e.target.value)) })}
            className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => removeRow(row.id)}
            className="text-gray-300 hover:text-red-500 text-lg leading-none shrink-0"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="w-full rounded border-2 border-dashed border-gray-200 py-1.5 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-600 transition-colors"
      >
        + Add SKU
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={loading}
          className="rounded bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save fulfillment"}
        </button>
        <button
          onClick={cancel}
          className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
