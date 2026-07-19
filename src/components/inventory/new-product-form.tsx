"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/constants";

export function NewProductForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body = {
      sku: (formData.get("sku") as string).toUpperCase().trim(),
      name: formData.get("name"),
      category: formData.get("category"),
      unit: formData.get("unit") || "Each",
      reorderPoint: Number(formData.get("reorderPoint") || 10),
      adminNotes: formData.get("adminNotes") || undefined,
    };

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.fieldErrors ? JSON.stringify(data.error.fieldErrors) : (data.error ?? "Failed to create product"));
      setLoading(false);
      return;
    }

    router.push("/inventory");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">SKU *</label>
        <input
          name="sku"
          required
          placeholder="T-TRAY-1850-SHB"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono uppercase"
        />
        <p className="mt-1 text-xs text-gray-500">Uppercase letters, numbers, hyphens only</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Name *</label>
        <input
          name="name"
          required
          placeholder="1850mm Tray with Headboard"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Category *</label>
        <select
          name="category"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Unit</label>
          <input
            name="unit"
            defaultValue="Each"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Reorder point</label>
          <input
            name="reorderPoint"
            type="number"
            defaultValue={10}
            min={0}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Admin notes</label>
        <textarea
          name="adminNotes"
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
          {loading ? "Creating..." : "Create SKU"}
        </button>
        <a href="/inventory" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </a>
      </div>
    </form>
  );
}
