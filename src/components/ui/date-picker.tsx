"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  name: string;
  value?: string; // "YYYY-MM-DD"
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYMD(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(s: string) {
  const d = parseYMD(s);
  if (!d) return "";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function DatePicker({
  name,
  value = "",
  onChange,
  required,
  placeholder = "Select date",
}: DatePickerProps) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const [viewYear, setViewYear] = useState(() => parseYMD(value)?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseYMD(value)?.getMonth() ?? today.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInternalValue(value);
    const d = parseYMD(value);
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  }, [value]);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(d: Date) {
    const v = toYMD(d);
    setInternalValue(v);
    setOpen(false);
    onChange?.(v);
  }

  function selectToday() {
    selectDay(today);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  function clear() {
    setInternalValue("");
    setOpen(false);
    onChange?.("");
  }

  // Build calendar grid (Mon-first)
  const firstDay = new Date(viewYear, viewMonth, 1);
  // Monday=0 ... Sunday=6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = toYMD(today);
  const selectedDate = parseYMD(internalValue);

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={internalValue} required={required} />

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors focus:outline-none"
      >
        <span className={`flex-1 ${internalValue ? "text-gray-900" : "text-gray-400"}`}>
          {internalValue ? formatDisplay(internalValue) : placeholder}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-md border border-gray-300 bg-white p-3 w-64">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">
              <ChevronLeft size={14} className="text-gray-500" />
            </button>
            <span className="text-sm font-medium text-gray-800">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">
              <ChevronRight size={14} className="text-gray-500" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const dStr = toYMD(d);
              const isSelected = dStr === internalValue;
              const isToday = dStr === todayStr;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(d)}
                  className={`text-xs rounded py-1.5 transition-colors focus:outline-none
                    ${isSelected
                      ? "bg-[#2563EB] text-white font-semibold"
                      : isToday
                        ? "text-[#2563EB] font-semibold hover:bg-gray-100"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={clear} className="text-xs text-gray-400 hover:text-gray-600">
              Clear
            </button>
            <button type="button" onClick={selectToday} className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium">
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
