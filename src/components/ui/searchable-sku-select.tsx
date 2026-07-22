"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface SkuOption {
  sku: string;
  name: string;
  category: string;
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
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

const DROPDOWN_MAX_H = 288; // max-h-72 = 288px
const DROPDOWN_MARGIN = 4;  // gap between trigger and dropdown

export function SearchableSkuSelect({ value, options, placeholder = "Select SKU", onChange, fullWidth = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < DROPDOWN_MAX_H + DROPDOWN_MARGIN && spaceAbove > spaceBelow;
    setPos({
      top: openUp ? rect.top - DROPDOWN_MARGIN : rect.bottom + DROPDOWN_MARGIN,
      left: rect.left,
      width: rect.width,
      openUp,
    });
  }, []);

  // Close on outside click; reposition on scroll
  useEffect(() => {
    if (!open) return;
    function handleClose(e: MouseEvent) {
      if (triggerRef.current && triggerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleScroll() {
      calcPos();
    }
    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, calcPos]);

  // Focus search box when dropdown opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  function handleToggle() {
    if (!open) calcPos();
    setOpen((o) => !o);
  }

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

  const dropdown = open && pos ? (
    <div
      style={{
        position: "fixed",
        top: pos.openUp ? undefined : pos.top,
        bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
        left: pos.left,
        width: Math.max(pos.width, 280),
        zIndex: 9999,
      }}
      className="rounded-md border border-gray-200 bg-white shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
    >
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
        {flatFiltered !== null && (
          flatFiltered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No SKUs match &quot;{query}&quot;</p>
          ) : (
            flatFiltered.map((o) => (
              <SkuRow key={o.sku} option={o} selected={value === o.sku} onSelect={select} query={query} />
            ))
          )
        )}

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
  ) : null;

  return (
    <div className={`relative ${fullWidth ? "w-full" : "inline-block"}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={`${fullWidth ? "w-full" : ""} flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        <span className={`flex-1 text-left truncate ${hasValue ? "text-gray-900" : "text-gray-400"}`}>
          {triggerLabel}
        </span>
        {hasValue && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
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

      {/* Portal dropdown — renders at document.body, never clipped by overflow containers */}
      {typeof document !== "undefined" && dropdown && createPortal(dropdown, document.body)}
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
        ${selected ? "bg-blue-50 text-[#2563EB]" : "text-gray-700 hover:bg-blue-50"}`}
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
