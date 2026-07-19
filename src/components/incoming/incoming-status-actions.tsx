"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INCOMING_TRANSITIONS, type IncomingStatus } from "@/lib/constants";

const BTN_LABELS: Record<string, string> = {
  shipped: "Mark shipped",
  in_transit: "Mark in transit",
  arrived: "Mark arrived",
  confirmed: "Confirm & receive stock",
  cancelled: "Cancel",
};

const BTN_STYLES: Record<string, string> = {
  confirmed: "bg-green-600 text-white hover:bg-green-700",
  cancelled: "border border-red-300 text-red-600 hover:bg-red-50",
};

interface Props {
  id: string;
  currentStatus: string;
}

export function IncomingStatusActions({ id, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const allowed = INCOMING_TRANSITIONS[currentStatus as IncomingStatus] ?? [];

  async function transition(newStatus: string) {
    setLoading(newStatus);
    setError("");

    const res = await fetch(`/api/incoming/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
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

  if (allowed.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
      <div className="flex flex-wrap gap-2">
        {allowed.map((next) => (
          <button
            key={next}
            disabled={loading !== null}
            onClick={() => transition(next)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              BTN_STYLES[next] ?? "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {loading === next ? "..." : (BTN_LABELS[next] ?? next)}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
