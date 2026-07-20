"use client";

import { useRef } from "react";
import { CustomSelect } from "@/components/ui/custom-select";

const STATUS_OPTIONS = [
  { value: "quote", label: "Quote" },
  { value: "deposit_paid", label: "Deposit paid" },
  { value: "fully_paid", label: "Fully paid" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

interface SalesFiltersProps {
  defaultSearch?: string;
  defaultStatus?: string;
}

export function SalesFilters({ defaultSearch = "", defaultStatus = "" }: SalesFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="GET" className="flex flex-wrap gap-2 mb-4">
      <input
        name="search"
        defaultValue={defaultSearch}
        placeholder="Search customer, record ID..."
        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm w-56 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-gray-300"
      />
      <CustomSelect
        name="status"
        value={defaultStatus}
        options={STATUS_OPTIONS}
        placeholder="All statuses"
        onChange={() => formRef.current?.requestSubmit()}
      />
      <button
        type="submit"
        className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
      >
        Filter
      </button>
    </form>
  );
}
