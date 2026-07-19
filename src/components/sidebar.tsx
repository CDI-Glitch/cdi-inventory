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
    <aside className="w-56 flex flex-col bg-white border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">CDI Inventory</h2>
        <p className="text-xs text-gray-500 mt-0.5">{user.name} ({role})</p>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-gray-200">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
