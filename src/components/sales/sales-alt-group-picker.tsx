"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AltGroupTask } from "@/lib/alt-group-fulfillment";
import { formatAltGroupLabel } from "@/lib/alt-group-fulfillment";

export function SalesAltGroupPicker({
  salesRecordId,
  tasks,
  canEdit,
}: {
  salesRecordId: string;
  tasks: AltGroupTask[];
  canEdit: boolean;
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      {tasks.map((task) => (
        <AltGroupCard
          key={`${task.lineId}:${task.altGroupKey}`}
          salesRecordId={salesRecordId}
          task={task}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}

function AltGroupCard({
  salesRecordId,
  task,
  canEdit,
}: {
  salesRecordId: string;
  task: AltGroupTask;
  canEdit: boolean;
}) {
  const router = useRouter();
  const label = formatAltGroupLabel(task.altGroupKey);
  const [productId, setProductId] = useState(task.picked[0]?.productId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!productId) {
      setError("Select a SKU.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch(`/api/sales/${salesRecordId}/movements/alt-pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineId: task.lineId,
        altGroupKey: task.altGroupKey,
        productId,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to save pick";
      try {
        message = JSON.parse(text).error ?? message;
      } catch {}
      setError(typeof message === "string" ? message : "Failed to save pick");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  if (task.resolved) {
    const pickedLabel = task.picked.map((p) => `${p.sku} ×${p.qty}`).join(", ");
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Line {task.lineNo} · {label}: {pickedLabel || "picked"}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-semibold text-amber-900">
        Line {task.lineNo} · {label} — pick one
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Not reserved automatically. Select the SKU the warehouse will pick ({task.requiredQty} needed for {task.itemCode}).
        Completed is blocked until this is saved.
      </p>
      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-gray-700">
            SKU
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 block min-w-[16rem] rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {task.candidates.map((c) => (
                <option key={c.productId} value={c.productId}>
                  {c.sku} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <span className="pb-1.5 text-sm tabular-nums text-gray-700">×{task.requiredQty}</span>
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="rounded-md bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save pick"}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-800">You do not have permission to pick this SKU.</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
