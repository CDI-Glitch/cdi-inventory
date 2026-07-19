import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
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
