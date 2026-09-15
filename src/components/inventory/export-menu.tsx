"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";

export interface ExportOption {
  label: string;
  href: string;
}

interface Props {
  options: ExportOption[];
}

const ghostClass =
  "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50";

export function ExportMenu({ options }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (options.length === 0) return null;

  if (options.length === 1) {
    return (
      <a href={options[0].href} className={ghostClass}>
        <Download size={14} strokeWidth={2.25} aria-hidden="true" />
        {options[0].label}
      </a>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={ghostClass}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={14} strokeWidth={2.25} aria-hidden="true" />
        Export
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-md border border-gray-300 bg-white py-1"
        >
          {options.map((opt) => (
            <a
              key={opt.href}
              href={opt.href}
              role="menuitem"
              className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#2563EB]"
              onClick={() => setOpen(false)}
            >
              {opt.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
