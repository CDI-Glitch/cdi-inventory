"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSkuSelect, type SkuOption } from "@/components/ui/searchable-sku-select";

interface LineRow {
  productId: string;
  qtyOrdered: number;
  notes: string;
}

interface Props {
  products: { id: string; sku: string; name: string; category: string }[];
  locations: { id: string; name: string }[];
}

export function IncomingForm({ products, locations }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<LineRow[]>([
    { productId: "", qtyOrdered: 1, notes: "" },
  ]);
  const [locationId, setLocationId] = useState("");
  const [eta, setEta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Build sku options for SearchableSkuSelect (keyed by sku, resolved to productId on submit)
  const skuOptions: SkuOption[] = products.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
  }));

  // Map sku → productId for submission
  const skuToId = Object.fromEntries(products.map((p) => [p.sku, p.id]));

  function addLine() {
    setLines((prev) => [...prev, { productId: "", qtyOrdered: 1, notes: "" }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLineSku(idx: number, sku: string) {
    const productId = skuToId[sku] ?? "";
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, productId } : l)));
  }

  function updateLine(idx: number, field: keyof LineRow, value: string | number) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  // Get the sku for a line (reverse lookup)
  function getLineSku(line: LineRow): string {
    const product = products.find((p) => p.id === line.productId);
    return product?.sku ?? "";
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
      eta: eta || undefined,
      notes: formData.get("notes") || undefined,
      locationId,
      lines: lines.map((l) => ({
        productId: l.productId,
        qtyOrdered: l.qtyOrdered,
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

  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

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
            <CustomSelect
              name="locationId"
              value={locationId}
              options={locationOptions}
              placeholder="Select location"
              onChange={setLocationId}
              className="mt-1"
              fullWidth
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ETA</label>
            <div className="mt-1">
              <DatePicker name="eta" value={eta} onChange={setEta} placeholder="Select ETA" />
            </div>
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
            <div key={idx} className="rounded border border-gray-200 p-3 space-y-2">
              {/* Row 1: SKU full width */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">SKU *</label>
                <SearchableSkuSelect
                  value={getLineSku(line)}
                  options={skuOptions}
                  placeholder="Search SKU…"
                  onChange={(sku) => updateLineSku(idx, sku)}
                  fullWidth
                />
              </div>
              {/* Row 2: Qty + Notes + Remove */}
              <div className="flex items-end gap-2">
                <div className="w-32 shrink-0">
                  <label className="block text-xs text-gray-500 mb-1">Qty ordered</label>
                  <input
                    type="number"
                    min={1}
                    value={line.qtyOrdered}
                    onChange={(e) => updateLine(idx, "qtyOrdered", Number(e.target.value))}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex-1">
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
                    className="mb-0.5 text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove line"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !locationId}
          className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create shipment"}
        </button>
        <a
          href="/incoming"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
