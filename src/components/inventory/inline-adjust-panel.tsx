"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";

const TYPE_OPTIONS = [
  { value: "opening_stock",        label: "Opening stock" },
  { value: "receive_stock",        label: "Receive stock" },
  { value: "adjustment_in",        label: "Adjustment in (+)" },
  { value: "adjustment_out",       label: "Adjustment out (−)" },
  { value: "write_off",            label: "Write-off" },
  { value: "stocktake_correction", label: "Stocktake correction" },
];

interface Props {
  productId: string;
  locations: { id: string; name: string }[];
  onClose: () => void;
}

export default function InlineAdjustPanel({ productId, locations, onClose }: Props) {
  const router = useRouter();
  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState("");
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  async function handleSave() {
    if (!locationId || !type || !qty) return;
    setLoading(true);
    setError("");

    let delta = Number(qty);
    if (["adjustment_out", "write_off"].includes(type) && delta > 0) {
      delta = -delta;
    }

    const res = await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        locationId,
        type,
        delta,
        reference: reference || undefined,
        notes: notes || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Failed to save");
      setLoading(false);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-sm font-medium text-gray-700 mb-3">Adjust stock</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Location *</label>
          <CustomSelect
            name="locationId"
            value={locationId}
            options={locationOptions}
            placeholder="Select location"
            onChange={setLocationId}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type *</label>
          <CustomSelect
            name="type"
            value={type}
            options={TYPE_OPTIONS}
            placeholder="Select type"
            onChange={setType}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Quantity *</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="e.g. 5"
            className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Reference</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. PO-123"
            className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="mt-3">
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading || !locationId || !type || !qty}
          className="rounded bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save adjustment"}
        </button>
        <button
          onClick={onClose}
          className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
