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

function receivedClass(ordered: number, received: number) {
  if (received > ordered) return "text-orange-600";
  if (received < ordered) return "text-red-600";
  return "text-green-600";
}

export function IncomingLinesEditor({ shipmentId, lines: initialLines }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showFillModal, setShowFillModal] = useState(false);
  const [fillError, setFillError] = useState("");

  const zeroLines = lines.filter((l) => l.qtyReceived === 0);
  const alreadyTouched = lines.filter((l) => l.qtyReceived !== 0);

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
      setSaving(null);
      return false;
    }

    setSaving(null);
    return true;
  }

  function updateQtyReceived(lineId: string, val: number) {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, qtyReceived: val } : l))
    );
  }

  async function handleSaveRow(lineId: string, qtyReceived: number) {
    const ok = await saveReceived(lineId, qtyReceived);
    if (ok) router.refresh();
  }

  async function fillRemainingAsOrdered() {
    setFillError("");
    setSaving("bulk");
    const next = lines.map((l) =>
      l.qtyReceived === 0 ? { ...l, qtyReceived: l.qtyOrdered } : l
    );
    setLines(next);

    for (const line of next.filter((l) => zeroLines.some((z) => z.id === l.id))) {
      const ok = await saveReceived(line.id, line.qtyReceived);
      if (!ok) {
        setFillError(`Stopped at ${line.sku}. Fix the error and try again.`);
        setSaving(null);
        return;
      }
    }

    setSaving(null);
    setShowFillModal(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 border-b border-gray-100 px-4 py-2">
        <button
          type="button"
          disabled={zeroLines.length === 0 || saving !== null}
          onClick={() => setShowFillModal(true)}
          className="rounded-md bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Receive remaining as ordered
        </button>
      </div>

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
              <td className="px-4 py-2 font-mono text-[#2563EB]">{line.sku}</td>
              <td className="px-4 py-2 text-gray-900">{line.name}</td>
              <td className="px-4 py-2 text-right">{line.qtyOrdered}</td>
              <td className="px-4 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <input
                    type="number"
                    min={0}
                    value={line.qtyReceived}
                    onChange={(e) => updateQtyReceived(line.id, Number(e.target.value))}
                    className={`w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right ${receivedClass(line.qtyOrdered, line.qtyReceived)}`}
                  />
                </div>
                {errors[line.id] && (
                  <p className="text-xs text-red-500 mt-1">{errors[line.id]}</p>
                )}
              </td>
              <td className="px-4 py-2 text-gray-500 text-xs">{line.notes || "—"}</td>
              <td className="px-4 py-2">
                <button
                  onClick={() => handleSaveRow(line.id, line.qtyReceived)}
                  disabled={saving === line.id || saving === "bulk"}
                  className="rounded bg-blue-50 border border-blue-200 px-2 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-blue-100 disabled:opacity-50"
                >
                  {saving === line.id ? "..." : "Save"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showFillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">Receive remaining as ordered</h3>
            <p className="mt-2 text-sm text-gray-600">
              This fills Received = Ordered on <span className="font-medium">{zeroLines.length}</span> line
              {zeroLines.length === 1 ? "" : "s"} that are still 0. Lines you already changed
              ({alreadyTouched.length}) will not be overwritten.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Confirm you have checked the packing list against the physical count before filling.
              This does not post stock — you still need Confirm &amp; receive stock after reviewing the table.
            </p>
            {fillError && <p className="mt-2 text-sm text-red-600">{fillError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving === "bulk"}
                onClick={() => { setShowFillModal(false); setFillError(""); }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving === "bulk"}
                onClick={fillRemainingAsOrdered}
                className="rounded-md bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {saving === "bulk" ? "Saving..." : "I have checked — fill remaining"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
