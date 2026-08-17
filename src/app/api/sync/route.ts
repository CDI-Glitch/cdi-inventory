import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAllToShopify } from "@/lib/shopify-sync";
import { prisma } from "@/lib/db";
import { canRunSync, roleFromSession } from "@/lib/permissions";

const PAGE_SIZE = 50;

// GET — view sync logs with pagination
// ?page=1&pageSize=50
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !canRunSync(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") ?? String(PAGE_SIZE), 10)));

  const [total, logs] = await Promise.all([
    prisma.syncLog.count(),
    prisma.syncLog.findMany({
      include: {
        product: { select: { sku: true, name: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

// POST — trigger full sync to Shopify
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session || !canRunSync(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.SHOPIFY_CLIENT_ID || !process.env.SHOPIFY_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Shopify credentials not configured (SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET)" },
      { status: 400 }
    );
  }

  const result = await syncAllToShopify();
  return NextResponse.json(result);
}

// DELETE — clean up old sync logs
// ?keepDays=30  (default: keep last 30 days)
// ?keepCount=500 (alternative: keep latest N records)
// Admin only
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || !canRunSync(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const keepDaysParam = searchParams.get("keepDays");
  const keepCountParam = searchParams.get("keepCount");

  let deleted = 0;

  if (keepCountParam) {
    const keepCount = Math.max(0, parseInt(keepCountParam, 10));
    // Find the createdAt of the Nth record (the cutoff point)
    const cutoffRecord = await prisma.syncLog.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: keepCount,
      take: 1,
    });

    if (cutoffRecord.length > 0) {
      const result = await prisma.syncLog.deleteMany({
        where: { createdAt: { lte: cutoffRecord[0].createdAt } },
      });
      deleted = result.count;
    }
  } else {
    const keepDays = keepDaysParam ? Math.max(1, parseInt(keepDaysParam, 10)) : 30;
    const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
    const result = await prisma.syncLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    deleted = result.count;
  }

  return NextResponse.json({ deleted });
}
