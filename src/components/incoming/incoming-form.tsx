"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LineRow {
  productId: string;
  qtyOrdered: number;
  unitCost: string;
  notes: string;
}

interface Props {
  products: { id: string; sku: string; name: string }[];
  locations: { id: string; name: string }[];
}

export function IncomingForm({ products, locations }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<LineRow[]>([
    { productId: "", qtyOrdered: 1, unitCost: "", notes: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addLine() {
    setLines((prev) => [...prev, { productId: "", qtyOrdered: 1, unitCost: "", notes: "" }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, field: keyof LineRow, value: string | number) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (lines.some((l) => !l.productId)) {
      setError("All lines must have a SKU selected");
      setLoading(false);
      return;
    }

    const formData = new FormData(e.currentTarget);

    const body = {
      supplierName: formData.get("supplierName"),
      poNumber: formData.get("poNumber") || undefined,
      eta: formData.get("eta") || undefined,
      notes: formData.get("notes") || undefined,
      locationId: formData.get("locationId"),
      lines: lines.map((l) => ({
        productId: l.productId,
        qtyOrdered: l.qtyOrdered,
        unitCost: l.unitCost ? parseFloat(l.unitCost) : undefined,
        notes: l.notes || undefined,
      })),
    };

    const res = await fetch("/api/incoming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create shipment");
      setLoading(false);
      return;
    }

    router.push("/incoming");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Shipment details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Supplier *</label>
            <input
              name="supplierName"
              required
              placeholder="Supplier name"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">PO number</label>
            <input
              name="poNumber"
              placeholder="Supplier's PO #"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Destination *</label>
            <select
              name="locationId"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ETA</label>
            <input
              name="eta"
              type="date"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Optional notes"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Lines ({lines.length})</h2>
          <button
            type="button"
            onClick={addLine}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + Add line
          </button>
        </div>
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="rounded border border-gray-200 p-3 grid grid-cols-4 gap-2 items-end">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">SKU *</label>
                <select
                  value={line.productId}
                  onChange={(e) => updateLine(idx, "productId", e.target.value)}
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
                >
                  <option value="">Select SKU</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Qty ordered</label>
                <input
                  type="number"
                  min={1}
                  value={line.qtyOrdered}
                  onChange={(e) => updateLine(idx, "qtyOrdered", Number(e.target.value))}
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Unit cost (AUD)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={line.unitCost}
                  onChange={(e) => updateLine(idx, "unitCost", e.target.value)}
                  placeholder="0.00"
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input
                  type="text"
                  value={line.notes}
                  onChange={(e) => updateLine(idx, "notes", e.target.value)}
                  placeholder="Optional"
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="text-xs text-red-500 hover:text-red-700 pb-1.5"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create shipment"}
        </button>
        <a href="/incoming" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </a>
      </div>
    </form>
  );
}
