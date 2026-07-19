"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  products: { id: string; sku: string; name: string }[];
  bundles: { id: string; code: string; name: string }[];
  locations: { id: string; name: string }[];
}

export function NewSalesForm({ products, bundles, locations }: Props) {
  const router = useRouter();
  const [saleType, setSaleType] = useState<"sku" | "bundle">("sku");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body = {
      customer: formData.get("customer"),
      date: formData.get("date"),
      saleType,
      itemCode: formData.get("itemCode"),
      qty: Number(formData.get("qty") || 1),
      locationId: formData.get("locationId"),
      invoiceNo: formData.get("invoiceNo") || undefined,
      orderNo: formData.get("orderNo") || undefined,
      staffNotes: formData.get("staffNotes") || undefined,
    };

    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create record");
      setLoading(false);
      return;
    }

    const record = await res.json();
    router.push(`/sales/${record.id}`);
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className="max-w-lg bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Customer *</label>
        <input
          name="customer"
          required
          placeholder="e.g. John Smith"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Date *</label>
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Location *</label>
          <select
            name="locationId"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Type *</label>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={saleType === "sku"} onChange={() => setSaleType("sku")} />
            Individual SKU
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={saleType === "bundle"} onChange={() => setSaleType("bundle")} />
            Bundle
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {saleType === "sku" ? "SKU" : "Bundle"} *
        </label>
        <select
          name="itemCode"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        >
          <option value="">Select {saleType === "sku" ? "SKU" : "Bundle"}</option>
          {saleType === "sku"
            ? products.map((p) => (
                <option key={p.id} value={p.sku}>{p.sku} — {p.name}</option>
              ))
            : bundles.map((b) => (
                <option key={b.id} value={b.code}>{b.code} — {b.name}</option>
              ))}
        </select>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Invoice no.</label>
          <input
            name="invoiceNo"
            placeholder="INV-001"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Order no.</label>
          <input
            name="orderNo"
            placeholder="ORD-001"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Staff notes</label>
        <textarea
          name="staffNotes"
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create as Quote"}
        </button>
        <a href="/sales" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </a>
      </div>
    </form>
  );
}
