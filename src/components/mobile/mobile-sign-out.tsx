"use client";

import { signOut } from "next-auth/react";

export function MobileSignOut() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs font-medium text-white/50 hover:text-white"
    >
      Sign out
    </button>
  );
}
