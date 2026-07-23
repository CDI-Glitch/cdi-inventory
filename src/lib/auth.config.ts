import type { NextAuthConfig } from "next-auth";

// Edge-compatible config — no Node.js-only imports (no prisma, no bcrypt).
// DB-dependent logic (role refresh, active check) lives in auth.ts callbacks.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.id) return { ...session, user: undefined } as unknown as typeof session;
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isWebhook = nextUrl.pathname.startsWith("/api/webhooks");
      const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

      if (isWebhook || isAuthApi) return true;
      if (isOnLogin) return true;
      if (!isLoggedIn) return false;
      return true;
    },
  },
  providers: [],
  session: { strategy: "jwt" },
};
