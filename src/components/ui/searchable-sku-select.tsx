"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface SkuOption {
  sku: string;
  name: string;
  category: string;
}

interface Props {
  value: string;
  options: SkuOption[];
  placeholder?: string;
  onChange: (sku: string) => void;
  /** If true, fills 100% of parent width */
  fullWidth?: boolean;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-900 rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SearchableSkuSelect({ value, options, placeholder = "Select SKU", onChange, fullWidth = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus search box when dropdown opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  const selected = options.find((o) => o.sku === value);

  // Filter + group
  const { grouped, flatFiltered } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const flat = options.filter(
        (o) =>
          o.sku.toLowerCase().includes(q) ||
          o.name.toLowerCase().includes(q) ||
          o.category.toLowerCase().includes(q)
      );
      return { grouped: null, flatFiltered: flat };
    }
    // Group by category
    const groups: Record<string, SkuOption[]> = {};
    for (const o of options) {
      const cat = o.category.replace(/_/g, " ");
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(o);
    }
    return { grouped: groups, flatFiltered: null };
  }, [options, query]);

  function select(sku: string) {
    onChange(sku);
    setOpen(false);
    setQuery("");
  }

  const triggerLabel = selected ? `${selected.sku} — ${selected.name}` : placeholder;
  const hasValue = !!value;

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? "w-full" : "inline-block"}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${fullWidth ? "w-full" : ""} flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        <span className={`flex-1 text-left truncate ${hasValue ? "text-gray-900" : "text-gray-400"}`}>
          {triggerLabel}
        </span>
        {hasValue && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="shrink-0 text-gray-300 hover:text-gray-500"
            title="Clear"
          >
            <X size={13} />
          </span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] rounded-md border border-gray-200 bg-white shadow-lg">
          {/* Search box */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <Search size={13} className="shrink-0 text-gray-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU or name…"
              className="flex-1 text-sm outline-none placeholder-gray-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-gray-300 hover:text-gray-500">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-72 overflow-y-auto py-1">
            {/* Search results — flat */}
            {flatFiltered !== null && (
              flatFiltered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No SKUs match "{query}"</p>
              ) : (
                flatFiltered.map((o) => (
                  <SkuRow key={o.sku} option={o} selected={value === o.sku} onSelect={select} query={query} />
                ))
              )
            )}

            {/* Grouped — no search */}
            {grouped !== null &&
              Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-t border-b border-gray-100 first:border-t-0">
                    {cat}
                  </div>
                  {items.map((o) => (
                    <SkuRow key={o.sku} option={o} selected={value === o.sku} onSelect={select} query="" />
                  ))}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

function SkuRow({
  option,
  selected,
  onSelect,
  query,
}: {
  option: SkuOption;
  selected: boolean;
  onSelect: (sku: string) => void;
  query: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.sku)}
      className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors
        ${selected ? "bg-blue-50 text-[#2563EB]" : "text-gray-700 hover:bg-gray-50"}`}
    >
      <span className="mt-0.5 w-4 shrink-0">
        {selected && <Check size={14} className="text-[#2563EB]" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="font-mono text-xs">{highlight(option.sku, query)}</span>
        <span className="ml-2 text-gray-500 text-xs truncate">{highlight(option.name, query)}</span>
      </span>
    </button>
  );
}
