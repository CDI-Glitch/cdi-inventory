"use client";

import { useRef } from "react";
import { CustomSelect } from "@/components/ui/custom-select";
import { CATEGORIES } from "@/lib/constants";

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({
  value: c,
  label:
    c === "12V"
      ? "12V"
      : c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase()),
}));

// IN_STOCK is a UI-only combined filter (OK + REORDER, i.e. everything except
// OUT_OF_STOCK). It never appears as an actual row status value.
const STATUS_OPTIONS = [
  { value: "IN_STOCK", label: "In stock" },
  { value: "OK", label: "OK" },
  { value: "REORDER", label: "Reorder" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
];

interface InventoryFiltersProps {
  defaultSearch?: string;
  defaultCategory?: string;
  defaultStatus?: string;
  defaultIncomingOnly?: string;
  currentLoc?: string;
  currentForecast?: string;
  currentBackorder?: string;
  hideStatus?: boolean;
}

export function InventoryFilters({
  defaultSearch = "",
  defaultCategory = "",
  defaultStatus = "",
  defaultIncomingOnly = "",
  currentLoc = "",
  currentForecast = "",
  currentBackorder = "",
  hideStatus = false,
}: InventoryFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function submitForm() {
    // Use setTimeout to let the hidden input DOM value settle before submit
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  return (
    <form ref={formRef} method="GET" className="flex flex-wrap gap-2 mb-4">
      {/* Preserve current location tab and forecast mode across filter submissions */}
      {currentLoc && <input type="hidden" name="loc" value={currentLoc} />}
      {currentForecast && <input type="hidden" name="forecast" value={currentForecast} />}
      {currentBackorder && <input type="hidden" name="backorder" value={currentBackorder} />}
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
      {!hideStatus && (
        <CustomSelect
          name="status"
          value={defaultStatus}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          onChange={submitForm}
        />
      )}
      {currentForecast && (
        <label className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700">
          <input
            type="checkbox"
            name="incomingOnly"
            value="1"
            defaultChecked={defaultIncomingOnly === "1"}
            onChange={submitForm}
          />
          Incoming only
        </label>
      )}
      <button
        type="submit"
        className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
      >
        Filter
      </button>
    </form>
  );
}
