import type { NextAuthConfig } from "next-auth";
import { prisma } from "./db";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, seed the token from the authorize() return value
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        return token;
      }

      // On every subsequent request, re-fetch role + active from DB so that
      // permission changes and account deactivation take effect immediately
      // without requiring the user to log out and back in.
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, active: true },
          });
          // If user is deactivated or deleted, invalidate the token
          if (!dbUser || !dbUser.active) return {} as typeof token;
          token.role = dbUser.role;
        } catch {
          // DB unavailable — keep existing token rather than locking everyone out
        }
      }

      return token;
    },
    async session({ session, token }) {
      // If jwt() returned an empty token (deactivated user), clear the session
      if (!token.id) return { ...session, user: undefined } as typeof session;
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
