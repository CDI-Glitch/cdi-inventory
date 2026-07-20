"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface LocationTabsProps {
  locations: { id: string; name: string }[];
  current: string; // "" = All
}

export function LocationTabs({ locations, current }: LocationTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildUrl(loc: string) {
    const params = new URLSearchParams(searchParams.toString());
    // Remove pagination when switching tabs
    params.delete("page");
    if (loc) {
      params.set("loc", loc);
    } else {
      params.delete("loc");
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const tabs = [
    ...locations.map((l) => ({ label: l.name, value: l.name })),
    { label: "All locations", value: "" },
  ];

  return (
    <div className="flex items-center gap-0 border-b border-gray-200 mb-5">
      {tabs.map((tab, i) => {
        const isActive = current === tab.value;
        const isAll = tab.value === "";
        return (
          <Link
            key={tab.value || "all"}
            href={buildUrl(tab.value)}
            className={[
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              isAll ? "ml-4" : "",
              isActive
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
