import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/public/inventory?sku=<SKU>
 *
 * Public read-only endpoint — no auth required.
 * Returns per-location Available quantity (onHand − reserved) for a given SKU.
 * Used by the Shopify theme to display per-warehouse stock status on the PDP.
 *
 * Response: { "brisbane": 5, "sydney": 0 }
 * Keys are location names lowercased; value is Available qty (>= 0).
 *
 * Error cases:
 *   404 — SKU not found or not active
 *   400 — sku param missing
 *   500 — DB error
 */
export async function GET(req: NextRequest) {
  const sku = req.nextUrl.searchParams.get("sku");
  if (!sku) {
    return NextResponse.json({ error: "sku parameter required" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { sku, active: true },
    select: { id: true },
  });

  if (!product) {
    return NextResponse.json({ error: "SKU not found" }, { status: 404 });
  }

  const locations = await prisma.location.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const [allLogs, allMovements] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["locationId"],
      where: { productId: product.id },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["locationId"],
      where: { productId: product.id, reservedQty: { gt: 0 } },
      _sum: { reservedQty: true },
    }),
  ]);

  const logMap = new Map<string, number>();
  for (const log of allLogs) {
    logMap.set(log.locationId, log._sum.delta ?? 0);
  }

  const movMap = new Map<string, number>();
  for (const mov of allMovements) {
    movMap.set(mov.locationId, mov._sum.reservedQty ?? 0);
  }

  const result: Record<string, number> = {};
  for (const loc of locations) {
    const onHand = logMap.get(loc.id) ?? 0;
    const reserved = movMap.get(loc.id) ?? 0;
    const available = Math.max(0, onHand - reserved);
    result[loc.name.toLowerCase()] = available;
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
