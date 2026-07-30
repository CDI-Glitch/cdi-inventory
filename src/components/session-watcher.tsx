"use client";

import { useEffect, useRef } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * Detects role/active changes made server-side (e.g. an admin demoting or
 * deactivating another user) and reflects them in already-open tabs without
 * requiring a manual hard refresh.
 *
 * - `refetchOnWindowFocus` re-checks the session almost instantly when the
 *   user switches back to this tab.
 * - `refetchInterval` re-checks periodically even if the tab stays focused.
 *
 * This is a UX-freshness layer only. Actual authorization is always
 * re-verified server-side on every request (see src/lib/auth.ts jwt callback
 * and per-route role checks), so a stale UI here carries no security risk.
 */
function RoleWatcher() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const prevRoleRef = useRef<string | undefined>(undefined);
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      if (wasAuthenticatedRef.current) {
        // Account was deactivated (or session invalidated) mid-session.
        signOut({ callbackUrl: "/login" });
      }
      wasAuthenticatedRef.current = false;
      return;
    }

    wasAuthenticatedRef.current = true;
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (prevRoleRef.current !== undefined && prevRoleRef.current !== role) {
      router.refresh();
    }
    prevRoleRef.current = role;
  }, [session, status, router]);

  return null;
}

export function SessionWatcher({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <RoleWatcher />
      {children}
    </SessionProvider>
  );
}
