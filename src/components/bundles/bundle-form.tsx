"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMPONENT_ROLES } from "@/lib/constants";

interface BundleItemRow {
  productId: string;
  qty: number;
  componentRole: string;
  required: boolean;
  sortOrder: number;
  notes: string;
}

interface Props {
  products: { id: string; sku: string; name: string }[];
  bundle?: {
    id: string;
    code: string;
    name: string;
    productFamily: string;
    active: boolean;
    items: {
      id: string;
      productId: string;
      qty: number;
      componentRole: string;
      required: boolean;
      sortOrder: number;
      notes: string | null;
    }[];
  };
}

const ROLE_LABELS: Record<string, string> = {
  main_body: "Main body",
  body_attachment: "Body attachment",
  tray_mount: "Tray mount",
  hardware_bracket: "Hardware bracket",
};

export function BundleForm({ products, bundle }: Props) {
  const router = useRouter();
  const isEdit = !!bundle;

  const [items, setItems] = useState<BundleItemRow[]>(
    bundle?.items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      componentRole: i.componentRole,
      required: i.required,
      sortOrder: i.sortOrder,
      notes: i.notes ?? "",
    })) ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addItem() {
    setItems((prev) => [
      ...prev,
      { productId: "", qty: 1, componentRole: "main_body", required: true, sortOrder: prev.length, notes: "" },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof BundleItemRow, value: any) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    if (items.length === 0) {
      setError("Bundle must have at least one component");
      setLoading(false);
      return;
    }
    if (items.some((i) => !i.productId)) {
      setError("All components must have a SKU selected");
      setLoading(false);
      return;
    }

    const body = {
      code: (formData.get("code") as string).toUpperCase().trim(),
      name: formData.get("name"),
      productFamily: formData.get("productFamily"),
      items: items.map((item, idx) => ({ ...item, sortOrder: idx })),
    };

    const url = isEdit ? `/api/bundles/${bundle!.id}` : "/api/bundles";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save bundle");
      setLoading(false);
      return;
    }

    router.push("/bundles");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Bundle details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Code *</label>
            <input
              name="code"
              required
              defaultValue={bundle?.code}
              readOnly={isEdit}
              placeholder="BDL-HILUX-TRAY"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono uppercase disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Product family *</label>
            <input
              name="productFamily"
              required
              defaultValue={bundle?.productFamily}
              placeholder="tray"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Name *</label>
          <input
            name="name"
            required
            defaultValue={bundle?.name}
            placeholder="Hilux Tray Kit"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Components */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Components ({items.length})</h2>
          <button
            type="button"
            onClick={addItem}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + Add component
          </button>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No components yet. Add at least one.</p>
        )}

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-md border border-gray-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Component {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">SKU *</label>
                  <select
                    value={item.productId}
                    onChange={(e) => updateItem(idx, "productId", e.target.value)}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
                  >
                    <option value="">Select SKU</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Role</label>
                  <select
                    value={item.componentRole}
                    onChange={(e) => updateItem(idx, "componentRole", e.target.value)}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {COMPONENT_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) => updateItem(idx, "required", e.target.checked)}
                    />
                    Required
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => updateItem(idx, "notes", e.target.value)}
                  placeholder="Optional note"
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[#839DC0] px-4 py-2 text-sm font-medium text-white hover:bg-[#6a88ad] disabled:opacity-50"
        >
          {loading ? "Saving..." : isEdit ? "Save changes" : "Create bundle"}
        </button>
        <a href="/bundles" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </a>
      </div>
    </form>
  );
}
