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
  currentLoc?: string;
}

export function SalesFilters({ defaultSearch = "", defaultStatus = "", currentLoc = "" }: SalesFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="GET" className="flex flex-wrap gap-2 mb-4">
      {/* Preserve current location tab across filter submissions */}
      {currentLoc && <input type="hidden" name="loc" value={currentLoc} />}
      <input
        name="search"
        defaultValue={defaultSearch}
        placeholder="Search customer, record ID..."
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm w-56 focus:outline-none"
      />
      <CustomSelect
        name="status"
        value={defaultStatus}
        options={STATUS_OPTIONS}
        placeholder="All statuses"
        onChange={() => setTimeout(() => formRef.current?.requestSubmit(), 0)}
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
