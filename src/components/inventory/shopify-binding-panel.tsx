"use client";

import { useState } from "react";

interface Props {
  sku: string;
  shopifyInventoryItemId: string | null;
  shopifyVariantId: string | null;
  saveUrl?: string;
  readOnly?: boolean;
}

export function ShopifyBindingPanel({ sku, shopifyInventoryItemId, shopifyVariantId, saveUrl, readOnly = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [itemId, setItemId] = useState(shopifyInventoryItemId ?? "");
  const [variantId, setVariantId] = useState(shopifyVariantId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState({ itemId: shopifyInventoryItemId, variantId: shopifyVariantId });

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(saveUrl ?? `/api/products/${encodeURIComponent(sku)}`, {
        method: saveUrl ? "PUT" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopifyInventoryItemId: itemId.trim() || null,
          shopifyVariantId: variantId.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setSaved({ itemId: itemId.trim() || null, variantId: variantId.trim() || null });
      setEditing(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setItemId(saved.itemId ?? "");
    setVariantId(saved.variantId ?? "");
    setEditing(false);
    setError(null);
  }

  const isLinked = !!(saved.itemId);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Shopify sync</h3>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            isLinked ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
          }`}>
            {isLinked ? "Linked" : "Not linked"}
          </span>
        </div>
        {!editing && !readOnly && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Inventory Item ID
              <span className="ml-1 text-gray-400 font-normal">(digits only, e.g. 12345678)</span>
            </label>
            <input
              type="text"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="e.g. 45678901234"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Variant ID
              <span className="ml-1 text-gray-400 font-normal">(optional, digits only)</span>
            </label>
            <input
              type="text"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              placeholder="e.g. 98765432100"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handleCancel}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-36 shrink-0">Inventory Item ID</span>
            <span className="font-mono text-gray-900">
              {saved.itemId ?? <span className="text-gray-400 font-sans">—</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-36 shrink-0">Variant ID</span>
            <span className="font-mono text-gray-900">
              {saved.variantId ?? <span className="text-gray-400 font-sans">—</span>}
            </span>
          </div>
          {isLinked && (
            <p className="text-xs text-gray-400 pt-1">
              This SKU will be included in the next Shopify sync.
            </p>
          )}
          {!isLinked && (
            <p className="text-xs text-gray-400 pt-1">
              Enter an Inventory Item ID to include this SKU in Shopify sync.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
