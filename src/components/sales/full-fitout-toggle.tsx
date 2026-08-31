"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  salesRecordId: string;
  initialValue: boolean;
}

/**
 * Annotation-only flag ("full vehicle fit-out" vs. partial/accessory order).
 * Editable at any status via a dedicated PATCH route — unlike header fields,
 * this is not part of the invoice/fulfillment record and is not locked after
 * the quote stage.
 */
export function FullFitoutToggle({ salesRecordId, initialValue }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !value;
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${salesRecordId}/annotation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFullFitOut: next }),
      });
      if (res.ok) {
        setValue(next);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        disabled={saving}
        onChange={toggle}
        className="h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB] disabled:opacity-50"
      />
      Full vehicle fit-out
    </label>
  );
}
