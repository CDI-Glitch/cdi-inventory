"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INVENTORY_LOG_TYPES } from "@/lib/constants";

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const type = formData.get("type") as string;
    let delta = Number(formData.get("delta"));

    // adjustment_out and write_off should be negative
    if (["adjustment_out", "write_off"].includes(type) && delta > 0) {
      delta = -delta;
    }

    const body = {
      productId: formData.get("productId"),
      locationId: formData.get("locationId"),
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
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Product (SKU) *</label>
        <select
          name="productId"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select SKU</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Location *</label>
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
        <label className="block text-sm font-medium text-gray-700">Type *</label>
        <select
          name="type"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select type</option>
          {MANUAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
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
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
