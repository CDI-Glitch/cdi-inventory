"use client";

import { useState } from "react";
import Link from "next/link";
import { PrintButton } from "@/components/sales/print-button";
import { formatAltGroupLabel, type AltGroupTask } from "@/lib/alt-group-fulfillment";
import type { FulfillmentDisplayRow } from "@/lib/sales-fulfillment-view";

type PacklistRecord = {
  id: string;
  recordId: string;
  customer: string;
  dateStr: string;
  location: string;
  invoiceOrQuote: string | null;
  staffNotes: string | null;
};

export function PacklistDocument({
  record,
  printedAt,
  unresolved,
  rows,
}: {
  record: PacklistRecord;
  printedAt: string;
  unresolved: AltGroupTask[];
  rows: FulfillmentDisplayRow[];
}) {
  const [orderNote, setOrderNote] = useState("");
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});

  return (
    <div className="packlist mx-auto max-w-3xl">
      <div className="print:hidden mb-6 flex items-center justify-between gap-3">
        <Link href={`/sales/${record.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {record.recordId}
        </Link>
        <div className="flex items-center gap-3">
          <p className="max-w-xs text-right text-xs text-gray-500">
            Not saved — jot down anything before printing
          </p>
          <PrintButton />
        </div>
      </div>

      <header className="mb-6 border-b border-gray-300 pb-4">
        <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Pack list</p>
        <h1 className="mt-1 font-mono text-2xl font-bold text-gray-900">{record.recordId}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
          <div>
            <dt className="text-xs text-gray-500">Customer</dt>
            <dd>{record.customer}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Date</dt>
            <dd>{record.dateStr}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Location</dt>
            <dd>{record.location}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Invoice / Quote</dt>
            <dd>{record.invoiceOrQuote || "—"}</dd>
          </div>
        </dl>
        {record.staffNotes ? (
          <p className="mt-3 text-xs text-gray-500">
            Staff notes on record: {record.staffNotes}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-gray-500">
          Printed: {printedAt} (Brisbane) — reprint if fulfillment changes
        </p>
      </header>

      {unresolved.length > 0 && (
        <div className="mb-4 border border-amber-400 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-900">Pick one before completing</p>
          {unresolved.map((task) => (
            <p key={`${task.lineId}:${task.altGroupKey}`} className="mt-1 text-amber-800">
              Line {task.lineNo} · {formatAltGroupLabel(task.altGroupKey)} ×{task.requiredQty}:{" "}
              {task.candidates.map((c) => c.sku).join(" / ")}
            </p>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No fulfillment rows to pick.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-900 text-left">
              <th className="w-8 py-2">✓</th>
              <th className="py-2">SKU</th>
              <th className="py-2">Name</th>
              <th className="py-2 text-center">Qty</th>
              <th className="w-32 py-2 print:w-24">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-200">
                <td className="py-2.5">
                  <span className="inline-block h-4 w-4 border border-gray-700" />
                </td>
                <td className="py-2.5 font-mono text-xs">{row.sku}</td>
                <td className="py-2.5">{row.name}</td>
                <td className="py-2.5 text-center tabular-nums font-medium">{row.qty}</td>
                <td className="py-2.5">
                  <input
                    type="text"
                    value={lineNotes[row.id] ?? ""}
                    onChange={(e) =>
                      setLineNotes((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    className="w-full border-0 border-b border-dashed border-gray-300 bg-transparent px-0 py-0.5 text-xs text-gray-800 outline-none print:border-gray-400"
                    aria-label={`Note for ${row.sku}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="mt-8 border-t border-gray-300 pt-4 print:break-inside-avoid">
        <p className="text-xs font-semibold text-gray-500 uppercase">
          Notes (this printout only — not saved)
        </p>
        <textarea
          className="mt-2 h-24 w-full border border-dashed border-gray-300 p-2 text-sm print:hidden"
          value={orderNote}
          onChange={(e) => setOrderNote(e.target.value)}
          placeholder="Write anything for this pick — not saved after you leave this page"
        />
        <div className="mt-2 hidden min-h-24 whitespace-pre-wrap border border-gray-300 p-2 text-sm print:block">
          {orderNote || "\u00A0"}
        </div>
      </section>
    </div>
  );
}
