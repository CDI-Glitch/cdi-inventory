"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INVENTORY_LOG_TYPES } from "@/lib/constants";
import { CustomSelect } from "@/components/ui/custom-select";

const TYPE_LABELS: Record<string, string> = {
  opening_stock: "Opening stock",
  receive_stock: "Receive stock",
  adjustment_in: "Adjustment in (+)",
  adjustment_out: "Adjustment out (-)",
  write_off: "Write-off",
  stocktake_correction: "Stocktake correction",
};

const MANUAL_TYPES = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

interface Props {
  products: { id: string; sku: string; name: string }[];
  locations: { id: string; name: string }[];
}

export function AdjustForm({ products, locations }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    let delta = Number(formData.get("delta"));

    if (["adjustment_out", "write_off"].includes(type) && delta > 0) {
      delta = -delta;
    }

    const body = {
      productId,
      locationId,
      type,
      delta,
      reference: formData.get("reference") || undefined,
      notes: formData.get("notes") || undefined,
    };

    const res = await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to adjust stock");
      setLoading(false);
      return;
    }

    setSuccess("Stock adjusted successfully");
    setLoading(false);
    setProductId("");
    setLocationId("");
    setType("");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  const productOptions = products.map(p => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
  const locationOptions = locations.map(l => ({ value: l.id, label: l.name }));

  return (
    <form onSubmit={handleSubmit} className="max-w-lg bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Product (SKU) *</label>
        <CustomSelect
          name="productId"
          value={productId}
          options={productOptions}
          placeholder="Select SKU"
          onChange={setProductId}
          className="mt-1 w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Location *</label>
        <CustomSelect
          name="locationId"
          value={locationId}
          options={locationOptions}
          placeholder="Select location"
          onChange={setLocationId}
          className="mt-1 w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Type *</label>
        <CustomSelect
          name="type"
          value={type}
          options={MANUAL_TYPES}
          placeholder="Select type"
          onChange={setType}
          className="mt-1 w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Quantity *</label>
        <input
          name="delta"
          type="number"
          required
          min={1}
          placeholder="e.g. 5"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">Enter a positive number. For write-off/adjustment out, sign is applied automatically.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Reference</label>
        <input
          name="reference"
          placeholder="e.g. PO-123, SR-0001"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          name="notes"
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !productId || !locationId || !type}
          className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save adjustment"}
        </button>
        <a href="/inventory" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Back
        </a>
      </div>
    </form>
  );
}
