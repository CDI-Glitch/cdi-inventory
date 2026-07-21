"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Layers,
  Truck,
  ArrowLeftRight,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";

interface SidebarProps {
  user: { name?: string | null; role?: string };
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["viewer", "editor", "admin"] },
  { href: "/inventory", label: "Inventory", icon: Package, roles: ["viewer", "editor", "admin"] },
  { href: "/sales", label: "Sales", icon: ShoppingCart, roles: ["viewer", "editor", "admin"] },
  { href: "/bundles", label: "Bundles", icon: Layers, roles: ["admin"] },
  { href: "/incoming", label: "Incoming", icon: Truck, roles: ["editor", "admin"] },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight, roles: ["editor", "admin"] },
  { href: "/audit-log", label: "Audit Log", icon: FileText, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const role = user.role || "viewer";

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 flex flex-col bg-[#F8F9FB] border-r border-gray-200/80">
      {/* Logo area — generous padding for breathing room */}
      <div className="px-6 pt-7 pb-6">
        <Image src="/logo-cdi.svg" alt="CDI" width={140} height={32} />
        <p className="text-[10px] text-gray-400 mt-3 font-semibold tracking-[0.12em] uppercase">
          Inventory Portal
        </p>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gray-200/80 mb-2" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                active
                  ? "bg-white text-[#1D4ED8] font-semibold shadow-sm shadow-gray-200/80"
                  : "text-gray-500 font-medium hover:bg-white/70 hover:text-gray-800"
              )}
            >
              {/* Active accent bar */}
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#2563EB]" />
              )}
              <item.icon className={cn("h-[15px] w-[15px] shrink-0", active ? "text-[#2563EB]" : "text-gray-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="mx-4 h-px bg-gray-200/80 mb-2" />
      <div className="px-3 pb-4 pt-1 space-y-0.5">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-6 w-6 rounded-full bg-[#2563EB]/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[#2563EB]">
              {(user.name?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{user.name}</p>
            <p className="text-[10px] text-gray-400 capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-white/70 hover:text-gray-700 transition-all duration-150"
        >
          <LogOut className="h-[15px] w-[15px] shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
