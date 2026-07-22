"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface LocationTabsProps {
  locations: { id: string; name: string }[];
  current: string;
  /** When true, renders an "All" tab that sets loc=all */
  showAll?: boolean;
}

export function LocationTabs({ locations, current, showAll = false }: LocationTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildUrl(loc: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.set("loc", loc);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex items-center gap-0 border-b border-gray-200 mb-5">
      {showAll && (
        <Link
          href={buildUrl("all")}
          className={[
            "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
            current === "all"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          ].join(" ")}
        >
          All
        </Link>
      )}
      {locations.map((loc) => {
        const isActive = current === loc.name;
        return (
          <Link
            key={loc.id}
            href={buildUrl(loc.name)}
            className={[
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              isActive
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
            ].join(" ")}
          >
            {loc.name}
          </Link>
        );
      })}
    </div>
  );
}
