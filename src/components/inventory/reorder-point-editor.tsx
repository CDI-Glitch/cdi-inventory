"use client";

import { useState } from "react";

interface Props {
  sku: string;
  initialValue: number;
}

export default function ReorderPointEditor({ sku, initialValue }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(sku)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorderPoint: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Save failed");
        setPending(false);
        return;
      }
      setEditing(false);
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  function cancel() {
    setValue(initialValue);
    setEditing(false);
    setError(null);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
        />
        <button
          onClick={save}
          disabled={pending}
          className="text-xs rounded bg-blue-600 px-2.5 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={cancel}
          className="text-xs rounded border border-gray-200 px-2.5 py-1 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-gray-900">{value}</span>
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-blue-600 hover:text-blue-800"
      >
        Edit
      </button>
    </div>
  );
}
