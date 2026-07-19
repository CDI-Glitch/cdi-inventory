import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { UsersPanel } from "@/components/settings/users-panel";
import { LocationsPanel } from "@/components/settings/locations-panel";
import { SyncPanel } from "@/components/settings/sync-panel";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session?.user as any)?.role;
  if (role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const tab = params.tab ?? "users";

  const [users, locations, syncLogs] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.syncLog.findMany({
      include: { product: { select: { sku: true, name: true } }, location: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const TABS = [
    { id: "users", label: "Users" },
    { id: "locations", label: "Locations" },
    { id: "shopify", label: "Shopify Sync" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage users, locations, and integrations</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`?tab=${t.id}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {tab === "users" && <UsersPanel users={users} />}
      {tab === "locations" && <LocationsPanel locations={locations} />}
      {tab === "shopify" && <SyncPanel syncLogs={syncLogs} />}
    </div>
  );
}
