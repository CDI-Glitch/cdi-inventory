"use client";

import { useRef, useState } from "react";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";

const TYPE_OPTIONS = [
  { value: "opening_stock", label: "Opening Stock" },
  { value: "receive_stock", label: "Receive Stock" },
  { value: "sales_deduction", label: "Sales Deduction" },
  { value: "adjustment_in", label: "Adjustment In" },
  { value: "adjustment_out", label: "Adjustment Out" },
  { value: "write_off", label: "Write Off" },
  { value: "stocktake_correction", label: "Stocktake Correction" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "transfer_in", label: "Transfer In" },
];

interface AuditFiltersProps {
  defaultSku?: string;
  defaultType?: string;
  defaultLocation?: string;
  defaultFrom?: string;
  defaultTo?: string;
  locations: { id: string; name: string }[];
}

export function AuditFilters({
  defaultSku = "",
  defaultType = "",
  defaultLocation = "",
  defaultFrom = "",
  defaultTo = "",
  locations,
}: AuditFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const locationOptions = locations.map(l => ({ value: l.id, label: l.name }));

  function submit() {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} method="GET" className="flex flex-wrap gap-3 mb-6">
      <input
        name="sku"
        defaultValue={defaultSku}
        placeholder="Filter by SKU…"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none w-36"
      />

      <CustomSelect
        name="type"
        value={defaultType}
        options={TYPE_OPTIONS}
        placeholder="All types"
        onChange={submit}
      />

      <CustomSelect
        name="location"
        value={defaultLocation}
        options={locationOptions}
        placeholder="All locations"
        onChange={submit}
      />

      <div className="flex items-center gap-2">
        <DatePicker name="from" value={from} onChange={v => { setFrom(v); }} placeholder="From" />
        <span className="text-gray-400 text-sm">—</span>
        <DatePicker name="to" value={to} onChange={v => { setTo(v); }} placeholder="To" />
      </div>

      <button
        type="submit"
        className="rounded-md bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
      >
        Filter
      </button>
      <a
        href="/audit-log"
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Clear
      </a>
    </form>
  );
}
