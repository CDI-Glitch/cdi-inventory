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
  currentLoc?: string;
}

export function InventoryFilters({
  defaultSearch = "",
  defaultCategory = "",
  defaultStatus = "",
  currentLoc = "",
}: InventoryFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function submitForm() {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} method="GET" className="flex flex-wrap gap-2 mb-4">
      {/* Preserve current location tab across filter submissions */}
      {currentLoc && <input type="hidden" name="loc" value={currentLoc} />}
      <input
        name="search"
        defaultValue={defaultSearch}
        placeholder="Search SKU or name..."
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm w-48 focus:outline-none"
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
