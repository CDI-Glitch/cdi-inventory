"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INCOMING_TRANSITIONS, type IncomingStatus } from "@/lib/constants";
import { DatePicker } from "@/components/ui/date-picker";

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

interface ReceiveSummary {
  match: number;
  short: number;
  over: number;
  zero: number;
}

interface Props {
  id: string;
  currentStatus: string;
  /** At least one line has qtyReceived > 0 — required before confirming */
  hasReceivedQty?: boolean;
  /** Whether shippedAt has already been captured — controls the one-time date prompt */
  hasShippedAt?: boolean;
  receiveSummary?: ReceiveSummary;
}

export function IncomingStatusActions({
  id,
  currentStatus,
  hasReceivedQty = true,
  hasShippedAt = false,
  receiveSummary,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showShippedAtPicker, setShowShippedAtPicker] = useState(false);
  const [shippedAtValue, setShippedAtValue] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [checkedCount, setCheckedCount] = useState(false);

  const allowed = INCOMING_TRANSITIONS[currentStatus as IncomingStatus] ?? [];

  async function transition(newStatus: string, shippedAt?: string) {
    setLoading(newStatus);
    setError("");

    const res = await fetch(`/api/incoming/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, ...(shippedAt ? { shippedAt } : {}) }),
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
    setShowShippedAtPicker(false);
  }

  function handleClick(next: string) {
    // First time marking "shipped": require the shipped date before proceeding.
    if (next === "shipped" && !hasShippedAt) {
      setShowShippedAtPicker(true);
      return;
    }
    if (next === "confirmed") {
      setCheckedCount(false);
      setShowConfirmModal(true);
      return;
    }
    transition(next);
  }

  function confirmReceive() {
    if (!checkedCount) {
      setError("Tick the checkbox to confirm you have checked received quantities.");
      return;
    }
    setShowConfirmModal(false);
    transition("confirmed");
  }

  function confirmShipped() {
    if (!shippedAtValue) {
      setError("Shipped date is required.");
      return;
    }
    transition("shipped", shippedAtValue);
  }

  if (allowed.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>

      {showShippedAtPicker ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipped date *</label>
            <DatePicker
              name="shippedAt"
              value={shippedAtValue}
              onChange={setShippedAtValue}
              placeholder="Select shipped date"
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              Record-keeping only — this cannot be changed afterward except by an admin.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={loading !== null || !shippedAtValue}
              onClick={confirmShipped}
              className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === "shipped" ? "..." : "Confirm shipped"}
            </button>
            <button
              disabled={loading !== null}
              onClick={() => { setShowShippedAtPicker(false); setError(""); }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          {allowed.map((next) => {
            const isConfirm = next === "confirmed";
            const blocked = isConfirm && !hasReceivedQty;
            return (
              <button
                key={next}
                disabled={loading !== null || blocked}
                title={blocked ? "Enter received quantities before confirming" : undefined}
                onClick={() => handleClick(next)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  BTN_STYLES[next] ?? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                }`}
              >
                {loading === next ? "..." : (BTN_LABELS[next] ?? next)}
              </button>
            );
          })}
          {!hasReceivedQty && currentStatus === "arrived" && (
            <p className="text-xs text-amber-600">
              Fill in received quantities before confirming.
            </p>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">Confirm & receive stock</h3>
            <p className="mt-2 text-sm text-gray-600">
              This posts inventory and locks the shipment. Check the Received column against the
              physical count before continuing.
            </p>
            {receiveSummary && (
              <ul className="mt-3 space-y-1 text-sm text-gray-700">
                <li>{receiveSummary.match} line{receiveSummary.match === 1 ? "" : "s"} match ordered</li>
                <li className={receiveSummary.short > 0 ? "text-red-600" : ""}>
                  {receiveSummary.short} short (received &lt; ordered)
                </li>
                <li className={receiveSummary.over > 0 ? "text-orange-600" : ""}>
                  {receiveSummary.over} over (received &gt; ordered)
                </li>
                <li className={receiveSummary.zero > 0 ? "text-amber-600" : ""}>
                  {receiveSummary.zero} still 0 — will not add stock
                </li>
              </ul>
            )}
            <label className="mt-4 flex items-start gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={checkedCount}
                onChange={(e) => { setCheckedCount(e.target.checked); setError(""); }}
                className="mt-0.5"
              />
              I have checked received quantities against the physical count
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => { setShowConfirmModal(false); setCheckedCount(false); }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading !== null || !checkedCount}
                onClick={confirmReceive}
                className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "confirmed" ? "..." : "Confirm & receive stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
