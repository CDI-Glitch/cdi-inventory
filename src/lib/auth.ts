import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
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
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.active) return null;

        const valid = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
