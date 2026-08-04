"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

function formatDisplay(iso: string | null): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString("en-AU");
}

function toYMD(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Inline-editable ETA control. Editors/admins can adjust the estimate at any time
 * (before confirmed/cancelled); everyone else sees a plain read-only value.
 */
export function EtaEditor({
  id,
  eta,
  canEdit,
}: {
  id: string;
  eta: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(eta ? toYMD(eta) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!value) {
      setError("ETA is required");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/incoming/${id}/eta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eta: value }),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to update ETA";
      try { message = JSON.parse(text).error ?? message; } catch {}
      setError(typeof message === "string" ? message : "Failed to update ETA");
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div>
        <span className="text-gray-500">ETA</span>
        <p className="font-medium text-gray-900 mt-0.5 flex items-center gap-1.5">
          {formatDisplay(eta)}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-gray-300 hover:text-[#2563EB] transition-colors"
              title="Edit ETA"
            >
              <Pencil size={13} />
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-gray-500">ETA</span>
      <div className="mt-1 flex items-center gap-2">
        <DatePicker name="eta" value={value} onChange={setValue} placeholder="Select ETA" />
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-md bg-[#2563EB] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {saving ? "..." : "Save"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => { setEditing(false); setError(""); setValue(eta ? toYMD(eta) : ""); }}
          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Read-only display for the "actual" shipped date, with an admin-only correction
 * control. Regular editors capture this once via the "Mark shipped" flow and can
 * never change it here — matches the Planned (ETA) vs Actual (shippedAt) pattern.
 */
export function ShippedAtDisplay({
  id,
  shippedAt,
  isAdmin,
}: {
  id: string;
  shippedAt: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(shippedAt ? toYMD(shippedAt) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!value) {
      setError("Shipped date is required");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/incoming/${id}/shipped-at`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shippedAt: value }),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to correct shipped date";
      try { message = JSON.parse(text).error ?? message; } catch {}
      setError(typeof message === "string" ? message : "Failed to correct shipped date");
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div>
        <span className="text-gray-500">Shipped date</span>
        <p className="font-medium text-gray-900 mt-0.5 flex items-center gap-1.5">
          {formatDisplay(shippedAt)}
          {isAdmin && shippedAt && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-gray-300 hover:text-[#2563EB] transition-colors"
              title="Correct shipped date (admin)"
            >
              <Pencil size={13} />
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-gray-500">Shipped date</span>
      <div className="mt-1 flex items-center gap-2">
        <DatePicker name="shippedAt" value={value} onChange={setValue} placeholder="Select date" />
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-md bg-[#2563EB] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {saving ? "..." : "Save"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => { setEditing(false); setError(""); setValue(shippedAt ? toYMD(shippedAt) : ""); }}
          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
      <p className="mt-1 text-xs text-amber-600">
        This correction is logged on /audit-log.
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
