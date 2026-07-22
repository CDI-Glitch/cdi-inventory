"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SearchableSkuSelect } from "@/components/ui/searchable-sku-select";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import type { SkuOption } from "@/components/ui/searchable-sku-select";

interface BundleItemPreview {
  sku: string;
  name: string;
  qty: number;
}

interface BundleOption {
  code: string;
  name: string;
  items: BundleItemPreview[];
}

interface SaleLine {
  id: string;
  lineType: "sku" | "bundle";
  itemCode: string;
  qty: number;
  notes: string;
}

interface ExistingLine {
  id: string;
  lineType: string;
  itemCode: string;
  qty: number;
  notes: string | null;
  sortOrder: number;
}

interface Props {
  salesRecordId: string;
  existingLines: ExistingLine[];
  skuOptions: SkuOption[];
  bundles: BundleOption[];
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function SalesLinesEditor({ salesRecordId, existingLines, skuOptions, bundles }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  const toEditLines = (): SaleLine[] =>
    existingLines
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({
        id: uid(),
        lineType: l.lineType as "sku" | "bundle",
        itemCode: l.itemCode,
        qty: l.qty,
        notes: l.notes ?? "",
      }));

  const [lines, setLines] = useState<SaleLine[]>(toEditLines);

  function openEdit() {
    setLines(toEditLines());
    setError("");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError("");
  }

  const bundleSelectOptions = bundles.map((b) => ({ value: b.code, label: `${b.code} — ${b.name}` }));

  const updateLine = useCallback((id: string, patch: Partial<SaleLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...patch };
        if (patch.lineType && patch.lineType !== l.lineType) updated.itemCode = "";
        return updated;
      })
    );
  }, []);

  const addLine = () =>
    setLines((prev) => [...prev, { id: uid(), lineType: "sku", itemCode: "", qty: 1, notes: "" }]);

  const removeLine = (id: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  function toggleBundle(lineId: string) {
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      next.has(lineId) ? next.delete(lineId) : next.add(lineId);
      return next;
    });
  }

  function getBundleItems(code: string) {
    return bundles.find((b) => b.code === code)?.items ?? [];
  }

  async function save() {
    if (lines.some((l) => !l.itemCode || l.qty < 1)) {
      setError("All lines must have an item and qty ≥ 1.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch(`/api/sales/${salesRecordId}/lines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: lines.map((l) => ({
          lineType: l.lineType,
          itemCode: l.itemCode,
          qty: l.qty,
          notes: l.notes.trim() || undefined,
        })),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save lines");
      setLoading(false);
      return;
    }
    setEditing(false);
    setLoading(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        onClick={openEdit}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Edit lines
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {lines.map((line, idx) => (
        <div key={line.id} className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50 p-3">
          <span className="mt-2 text-xs text-gray-400 w-5 text-right shrink-0">{idx + 1}</span>
          <div className="flex-1 space-y-2">
            {/* Type toggle */}
            <div className="flex gap-3">
              {(["sku", "bundle"] as const).map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    checked={line.lineType === t}
                    onChange={() => updateLine(line.id, { lineType: t })}
                    className="accent-blue-600"
                  />
                  <span className={cn("font-medium", line.lineType === t ? "text-blue-700" : "text-gray-500")}>
                    {t === "sku" ? "SKU" : "Bundle"}
                  </span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3">
                {line.lineType === "sku" ? (
                  <SearchableSkuSelect
                    value={line.itemCode}
                    options={skuOptions}
                    placeholder="Select SKU"
                    onChange={(val) => updateLine(line.id, { itemCode: val })}
                    fullWidth
                  />
                ) : (
                  <CustomSelect
                    name={`edit-line-bundle-${line.id}`}
                    value={line.itemCode}
                    options={bundleSelectOptions}
                    placeholder="Select Bundle"
                    onChange={(val) => updateLine(line.id, { itemCode: val })}
                    fullWidth
                  />
                )}
              </div>
              <input
                type="number"
                min={1}
                value={line.qty}
                onChange={(e) => updateLine(line.id, { qty: Math.max(1, Number(e.target.value)) })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <input
              type="text"
              value={line.notes}
              onChange={(e) => updateLine(line.id, { notes: e.target.value })}
              placeholder="Line notes (optional)"
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />

            {line.lineType === "bundle" && line.itemCode && (
              <div>
                <button type="button" onClick={() => toggleBundle(line.id)} className="text-xs text-blue-600 hover:text-blue-800">
                  {expandedBundles.has(line.id) ? "▾ Hide components" : "▸ Show components"}
                </button>
                {expandedBundles.has(line.id) && (
                  <div className="mt-1 rounded border border-blue-100 bg-blue-50 px-3 py-2 space-y-1">
                    {getBundleItems(line.itemCode).map((item) => (
                      <div key={item.sku} className="flex justify-between text-xs">
                        <span className="font-mono text-gray-700">{item.sku}</span>
                        <span className="text-gray-500">{item.name}</span>
                        <span className="tabular-nums text-gray-500">×{item.qty * line.qty}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeLine(line.id)}
            disabled={lines.length === 1}
            className="mt-1 text-gray-300 hover:text-red-500 disabled:opacity-30 text-lg leading-none shrink-0"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addLine}
        className="w-full rounded border-2 border-dashed border-gray-200 py-2 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-600 transition-colors"
      >
        + Add line
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={loading}
          className="rounded bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save lines"}
        </button>
        <button
          onClick={cancel}
          className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
