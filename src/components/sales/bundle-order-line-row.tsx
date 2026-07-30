"use client";

import { useState } from "react";

interface BundleComponent {
  sku: string;
  name: string;
  qty: number;
}

interface Props {
  idx: number;
  itemCode: string;
  itemName: string;
  qty: number;
  notes: string | null;
  components: BundleComponent[];
}

/**
 * Read-only Order-lines row for a `lineType: "bundle"` line. Renders the
 * summary row plus a collapsible breakdown of the BOM components (multiplied
 * by the line qty), so merchants can see what a bundle actually expands to
 * without leaving the sales detail page.
 */
export function BundleOrderLineRow({ idx, itemCode, itemName, qty, notes, components }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-b border-gray-100 last:border-0">
        <td className="px-4 py-2.5 text-gray-400 text-xs">{idx}</td>
        <td className="px-4 py-2.5">
          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
            Bundle
          </span>
        </td>
        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 hover:text-purple-700"
            title={open ? "Hide components" : "Show components"}
          >
            <span className="text-purple-500">{open ? "▾" : "▸"}</span>
            {itemCode}
          </button>
        </td>
        <td className="px-4 py-2.5 text-gray-600">{itemName}</td>
        <td className="px-4 py-2.5 text-center tabular-nums font-medium">{qty}</td>
        <td className="px-4 py-2.5 text-xs text-gray-400">{notes ?? "—"}</td>
      </tr>
      {open && (
        <tr className="border-b border-gray-100 last:border-0 bg-purple-50/40">
          <td />
          <td />
          <td colSpan={4} className="px-4 pb-2.5 pt-0">
            <div className="rounded border border-purple-100 bg-white px-3 py-2 space-y-1">
              {components.length === 0 ? (
                <div className="text-xs text-gray-400">No components found.</div>
              ) : (
                components.map((c) => (
                  <div key={c.sku} className="flex items-center justify-between text-xs gap-3">
                    <span className="font-mono text-gray-700 shrink-0">{c.sku}</span>
                    <span className="text-gray-500 truncate">{c.name}</span>
                    <span className="tabular-nums text-gray-500 shrink-0">×{c.qty * qty}</span>
                  </div>
                ))
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
