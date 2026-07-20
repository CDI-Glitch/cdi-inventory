"use client";

import { useRef } from "react";
import { CustomSelect } from "@/components/ui/custom-select";
import { CATEGORIES } from "@/lib/constants";

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({
  value: c,
  label: c.replace(/_/g, " "),
}));

const STATUS_OPTIONS = [
  { value: "OK", label: "OK" },
  { value: "REORDER", label: "Reorder" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
];

interface InventoryFiltersProps {
  defaultSearch?: string;
  defaultCategory?: string;
  defaultStatus?: string;
}

export function InventoryFilters({
  defaultSearch = "",
  defaultCategory = "",
  defaultStatus = "",
}: InventoryFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function submitForm() {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} method="GET" className="flex flex-wrap gap-2 mb-4">
      <input
        name="search"
        defaultValue={defaultSearch}
        placeholder="Search SKU or name..."
        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm w-48 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-gray-300"
      />
      <CustomSelect
        name="category"
        value={defaultCategory}
        options={CATEGORY_OPTIONS}
        placeholder="All categories"
        onChange={submitForm}
      />
      <CustomSelect
        name="status"
        value={defaultStatus}
        options={STATUS_OPTIONS}
        placeholder="All statuses"
        onChange={submitForm}
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
