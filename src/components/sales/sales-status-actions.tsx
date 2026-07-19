"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VALID_TRANSITIONS, type SalesStatus } from "@/lib/constants";

const STATUS_LABELS: Record<SalesStatus, string> = {
  quote: "Quote",
  deposit_paid: "Deposit paid",
  fully_paid: "Fully paid",
  completed: "Completed",
  cancelled: "Cancelled",
};

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

  const status = currentStatus as SalesStatus;
  const allowed = VALID_TRANSITIONS[status] ?? [];

  if (allowed.length === 0) return null;

  async function transition(newStatus: SalesStatus) {
    setLoading(newStatus);
    setError("");

    const res = await fetch(`/api/sales/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, version }),
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
      <div className="flex flex-wrap gap-2">
        {nextStatus && NEXT_BTN_LABELS[status] && (
          <button
            onClick={() => transition(nextStatus)}
            disabled={loading !== null}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
