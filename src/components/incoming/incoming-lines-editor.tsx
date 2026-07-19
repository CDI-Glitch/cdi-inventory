"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LineData {
  id: string;
  sku: string;
  name: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number | null;
  notes: string;
}

interface Props {
  shipmentId: string;
  lines: LineData[];
}

export function IncomingLinesEditor({ shipmentId, lines: initialLines }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function saveReceived(lineId: string, qtyReceived: number) {
    setSaving(lineId);
    setErrors((prev) => ({ ...prev, [lineId]: "" }));

    const res = await fetch(`/api/incoming/${shipmentId}/lines`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId, qtyReceived }),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to save";
      try { message = JSON.parse(text).error ?? message; } catch {}
      setErrors((prev) => ({ ...prev, [lineId]: message }));
    } else {
      router.refresh();
    }
    setSaving(null);
  }

  function updateQtyReceived(lineId: string, val: number) {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, qtyReceived: val } : l))
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 bg-gray-50">
          <th className="px-4 py-2 text-left font-medium text-gray-600">SKU</th>
          <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
          <th className="px-4 py-2 text-right font-medium text-gray-600">Ordered</th>
          <th className="px-4 py-2 text-right font-medium text-gray-600">Received</th>
          <th className="px-4 py-2 text-left font-medium text-gray-600">Notes</th>
          <th className="px-4 py-2" />
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="border-b border-gray-100">
            <td className="px-4 py-2 font-mono text-[#839DC0]">{line.sku}</td>
            <td className="px-4 py-2 text-gray-900">{line.name}</td>
            <td className="px-4 py-2 text-right">{line.qtyOrdered}</td>
            <td className="px-4 py-2 text-right">
              <div className="flex items-center justify-end gap-2">
                <input
                  type="number"
                  min={0}
                  max={line.qtyOrdered}
                  value={line.qtyReceived}
                  onChange={(e) => updateQtyReceived(line.id, Number(e.target.value))}
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right"
                />
              </div>
              {errors[line.id] && (
                <p className="text-xs text-red-500 mt-1">{errors[line.id]}</p>
              )}
            </td>
            <td className="px-4 py-2 text-gray-500 text-xs">{line.notes || "—"}</td>
            <td className="px-4 py-2">
              <button
                onClick={() => saveReceived(line.id, line.qtyReceived)}
                disabled={saving === line.id}
                className="rounded bg-blue-50 border border-blue-200 px-2 py-1 text-xs font-medium text-[#5d7da0] hover:bg-blue-100 disabled:opacity-50"
              >
                {saving === line.id ? "..." : "Save"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
