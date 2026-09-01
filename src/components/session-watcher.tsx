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
 * and per-route role checks), so a stale UI here carries no security risk —
 * softening the detection below only changes how fast a stale tab notices,
 * never whether a deactivated/demoted user can still act on the server.
 *
 * IMPORTANT — do not trust `status === "unauthenticated"` on its own.
 * NextAuth's client-side `fetchData()` returns the exact same `null` both
 * when the server genuinely has no session AND when the request itself
 * failed (offline, DNS hiccup, network handover between WiFi/cellular).
 * `useSession()` cannot tell these apart, so treating every transition as a
 * real logout causes false positives during ordinary network blips —
 * kicking the user to a broken `/login?error=MissingCSRF` state (the
 * signOut() redirect itself can fail CSRF mid-blip). This mirrors a fixed
 * bug in a comparable auth library ("session set to null on network
 * reconnect"), whose fix is the same pattern used here: only treat it as a
 * real logout once independently re-confirmed; preserve the current state
 * on a transport failure and let the next poll re-check.
 */
function RoleWatcher() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const prevRoleRef = useRef<string | undefined>(undefined);
  const wasAuthenticatedRef = useRef(false);
  const confirmingRef = useRef(false);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      if (wasAuthenticatedRef.current && !confirmingRef.current) {
        confirmingRef.current = true;
        confirmRealLogout()
          .then((confirmed) => {
            if (confirmed) {
              wasAuthenticatedRef.current = false;
              // redirect: false avoids NextAuth's own redirect-on-signout
              // path (and any ?error=... it could append if that request
              // itself hits a network blip); we navigate ourselves instead.
              signOut({ redirect: false }).finally(() => {
                router.replace("/login");
              });
            }
            // Not confirmed (network/transport error) — leave state as-is;
            // the next refetchInterval/window-focus poll will try again.
          })
          .finally(() => {
            confirmingRef.current = false;
          });
      }
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

/**
 * Independently re-checks the session with our own fetch, bypassing
 * whatever cached/SWR state useSession() is holding. Returns:
 * - `true`  — the server was actually reached and confirmed there is no
 *             session (real deactivation/logout)
 * - `false` — the request itself failed (offline, network handover, etc.),
 *             or the server unexpectedly still reports a session — either
 *             way, not a confirmed logout
 */
async function confirmRealLogout(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    const hasUser = !!data?.user;
    return !hasUser;
  } catch {
    // fetch threw — network error, not a server-confirmed logout
    return false;
  }
}

export function SessionWatcher({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <RoleWatcher />
      {children}
    </SessionProvider>
  );
}
