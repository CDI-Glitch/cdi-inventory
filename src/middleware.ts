import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Exclude static files, images, and Shopify webhook endpoint from auth
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.ico|api/webhooks).*)"],
};
