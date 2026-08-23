"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function withLoc(href: string, loc: string | null) {
  if (!loc) return href;
  const url = new URL(href, "http://local");
  url.searchParams.set("loc", loc);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loc = searchParams.get("loc");
  const forecast = searchParams.get("forecast") === "1";
  const backorder = searchParams.get("backorder") === "1" && !forecast;

  const items = [
    {
      href: withLoc("/m", loc),
      label: "Home",
      icon: LayoutDashboard,
      active: pathname === "/m",
    },
    {
      href: withLoc("/m/inventory", loc),
      label: "Stock",
      icon: Package,
      active: pathname.startsWith("/m/inventory") && !forecast && !backorder,
    },
    {
      href: withLoc("/m/inventory?forecast=1", loc),
      label: "Forecast",
      icon: TrendingUp,
      active: pathname.startsWith("/m/inventory") && forecast,
    },
    {
      href: withLoc("/m/inventory?backorder=1", loc),
      label: "Short",
      icon: AlertTriangle,
      active: pathname.startsWith("/m/inventory") && backorder,
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] print:hidden">
      <div className="grid grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
              item.active ? "text-[#2563EB]" : "text-gray-500"
            )}
          >
            <item.icon className="h-5 w-5" strokeWidth={item.active ? 2.25 : 1.75} />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
