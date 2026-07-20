"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  name: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onChange?: (value: string) => void;
  /** If true, selecting an option auto-submits the parent <form> */
  submitOnChange?: boolean;
  className?: string;
}

export function CustomSelect({
  name,
  value,
  options,
  placeholder = "All",
  onChange,
  submitOnChange = false,
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  // Sync if parent value changes (e.g. on navigation)
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === internalValue);
  const displayLabel = selected ? selected.label : placeholder;

  function select(val: string) {
    setInternalValue(val);
    setOpen(false);
    onChange?.(val);
    if (submitOnChange && hiddenRef.current?.form) {
      // Tiny delay so the hidden input value is committed before submit
      setTimeout(() => hiddenRef.current?.form?.requestSubmit(), 0);
    }
  }

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Hidden input carries the value for native form submission */}
      <input ref={hiddenRef} type="hidden" name={name} value={internalValue} />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none min-w-[120px]"
      >
        <span className="flex-1 text-left truncate">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-full rounded-md border border-gray-300 bg-white py-1">
          {/* "All" / placeholder option */}
          <button
            type="button"
            onClick={() => select("")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="w-4 shrink-0">
              {internalValue === "" && <Check size={14} className="text-[#2563EB]" />}
            </span>
            <span className="text-gray-400">{placeholder}</span>
          </button>

          <div className="my-1 border-t border-gray-100" />

          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors
                ${internalValue === opt.value
                  ? "bg-[#2563EB]/5 text-[#2563EB] font-medium"
                  : "text-gray-700 hover:bg-gray-50"
                }`}
            >
              <span className="w-4 shrink-0">
                {internalValue === opt.value && <Check size={14} className="text-[#2563EB]" />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
