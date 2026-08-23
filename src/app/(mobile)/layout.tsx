import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionWatcher } from "@/components/session-watcher";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { asRole, canAccessMobileView } from "@/lib/permissions";
import { MobileSignOut } from "@/components/mobile/mobile-sign-out";

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/m");

  const role = asRole((session.user as any)?.role);
  if (!canAccessMobileView(role)) redirect("/dashboard");

  const name = (session.user as any)?.name ?? "User";

  return (
    <SessionWatcher>
      <div className="min-h-dvh bg-[#F8F9FB]">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-[#111827] px-4 py-3">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-cdi-white.svg" alt="CDI" className="h-6 w-auto" />
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Stock lookup
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="max-w-[8rem] truncate text-right text-xs text-white/70">{name}</p>
            <MobileSignOut />
          </div>
        </header>
        <main className="px-4 pb-24 pt-4">{children}</main>
        <Suspense fallback={null}>
          <MobileBottomNav />
        </Suspense>
      </div>
    </SessionWatcher>
  );
}
