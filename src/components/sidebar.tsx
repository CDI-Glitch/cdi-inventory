"use client";

import Link from "next/link";
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
    <aside className="w-64 flex flex-col bg-[#111827]">
      {/* Logo area */}
      <div className="px-6 pt-7 pb-6">
        <img src="/logo-cdi-white.svg" alt="CDI" className="h-8 w-auto" />
        <p className="text-[10px] text-white/40 mt-3 font-semibold tracking-[0.12em] uppercase">
          Inventory Portal
        </p>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/10 mb-2" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                active
                  ? "bg-white/10 text-white font-semibold"
                  : "text-white/60 font-medium hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-[15px] w-[15px] shrink-0",
                  active ? "text-white" : "text-white/40"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="mx-4 h-px bg-white/10 mb-2" />
      <div className="px-3 pb-4 pt-1 space-y-0.5">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-white/80">
              {(user.name?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">{user.name}</p>
            <p className="text-[10px] text-white/40 capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/5 hover:text-white/80 transition-all duration-150"
        >
          <LogOut className="h-[15px] w-[15px] shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
