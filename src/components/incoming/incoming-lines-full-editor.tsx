"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchableSkuSelect, type SkuOption } from "@/components/ui/searchable-sku-select";
import { Trash2 } from "lucide-react";

interface LineRow {
  id: string;
  sku: string;
  qtyOrdered: number;
  unitCost: string;
  notes: string;
}

interface Props {
  shipmentId: string;
  initialLines: {
    id: string;
    sku: string;
    qtyOrdered: number;
    unitCost: number | null;
    notes: string;
  }[];
  skuOptions: SkuOption[];
  /** Map sku → productId */
  skuToId: Record<string, string>;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export function IncomingLinesFullEditor({
  shipmentId,
  initialLines,
  skuOptions,
  skuToId,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<LineRow[]>(
    initialLines.map((l) => ({
      id: l.id,
      sku: l.sku,
      qtyOrdered: l.qtyOrdered,
      unitCost: l.unitCost != null ? String(l.unitCost) : "",
      notes: l.notes,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: uid(), sku: "", qtyOrdered: 1, unitCost: "", notes: "" },
    ]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSku(idx: number, sku: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, sku } : r)));
  }

  function updateField(idx: number, field: keyof Omit<LineRow, "id" | "sku">, value: string | number) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  }

  async function handleSave() {
    if (rows.length === 0) {
      setError("At least one line is required.");
      return;
    }
    if (rows.some((r) => !r.sku)) {
      setError("All lines must have a SKU selected.");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      lines: rows.map((r) => ({
        productId: skuToId[r.sku] ?? "",
        qtyOrdered: r.qtyOrdered,
        unitCost: r.unitCost ? parseFloat(r.unitCost) : undefined,
        notes: r.notes || undefined,
      })),
    };

    const res = await fetch(`/api/incoming/${shipmentId}/lines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to save lines";
      try {
        message = JSON.parse(text).error ?? message;
      } catch {}
      setError(message);
      setSaving(false);
      return;
    }

    router.refresh();
    setSaving(false);
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 text-left font-medium text-gray-600 w-[35%]">SKU</th>
            <th className="px-4 py-2 text-right font-medium text-gray-600 w-24">Qty ordered</th>
            <th className="px-4 py-2 text-right font-medium text-gray-600 w-28">Unit cost (AUD)</th>
            <th className="px-4 py-2 text-left font-medium text-gray-600">Notes</th>
            <th className="px-4 py-2 w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} className="border-b border-gray-100">
              <td className="px-4 py-2">
                <SearchableSkuSelect
                  value={row.sku}
                  options={skuOptions}
                  placeholder="Search SKU…"
                  onChange={(sku) => updateSku(idx, sku)}
                  fullWidth
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  min={1}
                  value={row.qtyOrdered}
                  onChange={(e) => updateField(idx, "qtyOrdered", Number(e.target.value))}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-right"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={row.unitCost}
                  onChange={(e) => updateField(idx, "unitCost", e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-right"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => updateField(idx, "notes", e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </td>
              <td className="px-4 py-2 text-center">
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Remove line"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + Add line
        </button>
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#2563EB] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save lines"}
          </button>
        </div>
      </div>
    </div>
  );
}
