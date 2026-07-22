"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VALID_TRANSITIONS, type SalesStatus } from "@/lib/constants";

const NEXT_BTN_LABELS: Partial<Record<SalesStatus, string>> = {
  quote: "Mark deposit paid →",
  deposit_paid: "Mark fully paid →",
  fully_paid: "Mark completed →",
};

interface Props {
  id: string;
  currentStatus: string;
  version: number;
}

export function SalesStatusActions({ id, currentStatus, version }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  // invoiceNo input — only relevant for quote → deposit_paid
  const [invoiceNo, setInvoiceNo] = useState("");

  const status = currentStatus as SalesStatus;
  const allowed = VALID_TRANSITIONS[status] ?? [];

  if (allowed.length === 0) return null;

  const isQuoteToDeposit = status === "quote";

  async function transition(newStatus: SalesStatus) {
    setLoading(newStatus);
    setError("");

    const body: Record<string, any> = { status: newStatus, version };
    if (newStatus === "deposit_paid" && invoiceNo.trim()) {
      body.invoiceNo = invoiceNo.trim();
    }

    const res = await fetch(`/api/sales/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to update status";
      try { message = JSON.parse(text).error ?? message; } catch {}
      setError(message);
      setLoading(null);
      return;
    }

    router.refresh();
    setLoading(null);
  }

  const nextStatus = allowed.find((s) => s !== "cancelled");
  const canCancel = allowed.includes("cancelled");

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Actions</p>

      {/* Invoice no. input — only shown for quote → deposit_paid */}
      {isQuoteToDeposit && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Invoice no. <span className="text-gray-400 font-normal">(optional — locked after confirmation)</span>
          </label>
          <input
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="e.g. INV-0042"
            className="w-60 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {nextStatus && NEXT_BTN_LABELS[status] && (
          <button
            onClick={() => transition(nextStatus)}
            disabled={loading !== null}
            className="rounded-md bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {loading === nextStatus ? "Updating..." : NEXT_BTN_LABELS[status]}
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => {
              if (confirm("Cancel this sales record? Reserved stock will be released.")) {
                transition("cancelled");
              }
            }}
            disabled={loading !== null}
            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {loading === "cancelled" ? "Cancelling..." : "Cancel record"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
