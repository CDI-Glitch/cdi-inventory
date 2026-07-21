"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";

interface Props {
  products: { id: string; sku: string; name: string }[];
  locations: { id: string; name: string }[];
}

export function TransferForm({ products, locations }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body = {
      productId,
      fromLocationId,
      toLocationId,
      qty: Number(formData.get("qty")),
      notes: formData.get("notes") || undefined,
    };

    if (fromLocationId === toLocationId) {
      setError("Source and destination must be different");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create transfer");
      setLoading(false);
      return;
    }

    router.push("/transfers");
    router.refresh();
  }

  const productOptions = products.map(p => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
  const locationOptions = locations.map(l => ({ value: l.id, label: l.name }));

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5">
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">SKU *</label>
          <CustomSelect
            name="productId"
            value={productId}
            options={productOptions}
            placeholder="Select SKU"
            onChange={setProductId}
            className="mt-1"
            fullWidth
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">From *</label>
            <CustomSelect
              name="fromLocationId"
              value={fromLocationId}
              options={locationOptions}
              placeholder="Source"
              onChange={setFromLocationId}
              className="mt-1"
              fullWidth
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">To *</label>
            <CustomSelect
              name="toLocationId"
              value={toLocationId}
              options={locationOptions}
              placeholder="Destination"
              onChange={setToLocationId}
              className="mt-1"
              fullWidth
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Quantity *</label>
          <input
            name="qty"
            type="number"
            required
            min={1}
            defaultValue={1}
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
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !productId || !fromLocationId || !toLocationId}
          className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create transfer"}
        </button>
        <a href="/transfers" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </a>
      </div>
    </form>
  );
}
