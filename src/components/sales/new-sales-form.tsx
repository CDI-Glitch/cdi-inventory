"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";

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
  const [locationId, setLocationId] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [date, setDate] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body = {
      customer: formData.get("customer"),
      date,
      saleType,
      itemCode,
      qty: Number(formData.get("qty") || 1),
      locationId,
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

  const locationOptions = locations.map(l => ({ value: l.id, label: l.name }));
  const skuOptions = products.map(p => ({ value: p.sku, label: `${p.sku} — ${p.name}` }));
  const bundleOptions = bundles.map(b => ({ value: b.code, label: `${b.code} — ${b.name}` }));

  // Reset item selection when switching sale type
  function handleSaleTypeChange(t: "sku" | "bundle") {
    setSaleType(t);
    setItemCode("");
  }

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
          <div className="mt-1">
            <DatePicker name="date" value={date} onChange={setDate} required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Location *</label>
          <CustomSelect
            name="locationId"
            value={locationId}
            options={locationOptions}
            placeholder="Select"
            onChange={setLocationId}
            className="mt-1 w-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Type *</label>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={saleType === "sku"} onChange={() => handleSaleTypeChange("sku")} />
            Individual SKU
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={saleType === "bundle"} onChange={() => handleSaleTypeChange("bundle")} />
            Bundle
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {saleType === "sku" ? "SKU" : "Bundle"} *
        </label>
        <CustomSelect
          name="itemCode"
          value={itemCode}
          options={saleType === "sku" ? skuOptions : bundleOptions}
          placeholder={`Select ${saleType === "sku" ? "SKU" : "Bundle"}`}
          onChange={setItemCode}
          className="mt-1 w-full"
        />
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
          disabled={loading || !locationId || !itemCode || !date}
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
