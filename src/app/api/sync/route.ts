import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAllToShopify } from "@/lib/shopify-sync";
import { prisma } from "@/lib/db";

// GET — view recent sync logs
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.syncLog.findMany({
    include: { product: { select: { sku: true, name: true } }, location: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ logs });
}

// POST — trigger full sync to Shopify
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.SHOPIFY_ADMIN_API_TOKEN) {
    return NextResponse.json(
      { error: "Shopify API token not configured" },
      { status: 400 }
    );
  }

  const result = await syncAllToShopify();
  return NextResponse.json(result);
}
