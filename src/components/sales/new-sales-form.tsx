"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSkuSelect } from "@/components/ui/searchable-sku-select";
import type { SkuOption } from "@/components/ui/searchable-sku-select";
import { cn } from "@/lib/utils";

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

interface Props {
  products: SkuOption[];
  bundles: BundleOption[];
  locations: { id: string; name: string }[];
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyLine(): SaleLine {
  return { id: uid(), lineType: "sku", itemCode: "", qty: 1, notes: "" };
}

export function NewSalesForm({ products, bundles, locations }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Header fields
  const [customer, setCustomer] = useState("");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });
  const [quoteNo, setQuoteNo] = useState("");
  const [staffNotes, setStaffNotes] = useState("");

  // Lines
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()]);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));
  const bundleOptions = bundles.map((b) => ({ value: b.code, label: `${b.code} — ${b.name}` }));

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

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (id: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  const toggleBundleExpand = (lineId: string) => {
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      next.has(lineId) ? next.delete(lineId) : next.add(lineId);
      return next;
    });
  };

  const getBundleItems = (code: string) => bundles.find((b) => b.code === code)?.items ?? [];

  const isValid =
    customer.trim() &&
    locationId &&
    date &&
    lines.every((l) => l.itemCode && l.qty >= 1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: customer.trim(),
        date,
        locationId,
        quoteNo: quoteNo.trim() || undefined,
        staffNotes: staffNotes.trim() || undefined,
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
      setError(data.error ?? "Failed to create record");
      setLoading(false);
      return;
    }

    const record = await res.json();
    router.push(`/sales/${record.id}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: header info ── */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5 space-y-4 self-start">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Order details</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer *</label>
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              required
              placeholder="e.g. John Smith"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <DatePicker name="date" value={date} onChange={setDate} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location *</label>
              <CustomSelect
                name="locationId"
                value={locationId}
                options={locationOptions}
                placeholder="Select"
                onChange={setLocationId}
                fullWidth
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quote no. <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              value={quoteNo}
              onChange={(e) => setQuoteNo(e.target.value)}
              placeholder="Q-001"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Staff notes</label>
            <textarea
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ── Right: lines ── */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Items</h2>
            <span className="text-xs text-gray-400">{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
          </div>

          {lines.map((line, idx) => (
            <div key={line.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Card header: line number + type toggle + remove */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <span className="text-xs font-semibold text-gray-400 w-4 shrink-0">{idx + 1}</span>
                <div className="flex gap-4 flex-1">
                  {(["sku", "bundle"] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        checked={line.lineType === t}
                        onChange={() => updateLine(line.id, { lineType: t })}
                        className="accent-blue-600"
                      />
                      <span className={cn("font-medium", line.lineType === t ? "text-blue-700" : "text-gray-400")}>
                        {t === "sku" ? "SKU" : "Bundle"}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length === 1}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors shrink-0"
                  title="Remove line"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Card body */}
              <div className="px-4 py-3 space-y-2">
                {/* SKU / Bundle selector + Qty */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    {line.lineType === "sku" ? (
                      <SearchableSkuSelect
                        value={line.itemCode}
                        options={products}
                        placeholder="Select SKU"
                        onChange={(val) => updateLine(line.id, { itemCode: val })}
                        fullWidth
                      />
                    ) : (
                      <CustomSelect
                        name={`line-bundle-${line.id}`}
                        value={line.itemCode}
                        options={bundleOptions}
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
                    className="w-20 shrink-0 rounded border border-gray-300 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Qty"
                  />
                </div>

                {/* Notes */}
                <input
                  type="text"
                  value={line.notes}
                  onChange={(e) => updateLine(line.id, { notes: e.target.value })}
                  placeholder="Line notes (optional)"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />

                {/* Bundle components preview */}
                {line.lineType === "bundle" && line.itemCode && (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleBundleExpand(line.id)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {expandedBundles.has(line.id) ? "▾ Hide components" : "▸ Show components"}
                    </button>
                    {expandedBundles.has(line.id) && (
                      <div className="mt-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 space-y-1">
                        {getBundleItems(line.itemCode).length === 0 ? (
                          <p className="text-xs text-gray-400">No components defined</p>
                        ) : (
                          getBundleItems(line.itemCode).map((item) => (
                            <div key={item.sku} className="flex justify-between text-xs">
                              <span className="font-mono text-gray-700">{item.sku}</span>
                              <span className="text-gray-500">{item.name}</span>
                              <span className="tabular-nums text-gray-500">×{item.qty * line.qty}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addLine}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Add line
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center gap-3">
        {error && <p className="text-sm text-red-600 flex-1">{error}</p>}
        <div className="flex gap-3 ml-auto">
          <a
            href="/sales"
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={loading || !isValid}
            className="rounded bg-[#2563EB] px-5 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create as Quote"}
          </button>
        </div>
      </div>
    </form>
  );
}
