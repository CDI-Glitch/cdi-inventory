import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/public/inventory?sku=<SKU>
 *
 * Internal endpoint — called only by the cdi-inventory-worker Cloudflare Worker.
 * Requires the x-internal-key header to match PORTAL_INTERNAL_KEY env var.
 * Returns per-location stock status (not exact quantities) for a given SKU.
 *
 * Response: { "brisbane": "in_stock"|"out", "sydney": "in_stock"|"out" }
 * Keys are location names lowercased; value is "in_stock" when available > 0, else "out".
 * The Worker layer maps "out" + inventory_policy === "continue" to "backorder" on the client.
 *
 * Error cases:
 *   403 — missing or invalid x-internal-key
 *   404 — SKU not found or not active
 *   400 — sku param missing
 *   500 — DB error
 */

export async function OPTIONS() {
  // Preflight is handled at the Worker layer — Portal is not called by browsers directly.
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  // Verify shared secret — reject any caller that is not the Worker.
  const internalKey = req.headers.get("x-internal-key");
  const expectedKey = process.env.PORTAL_INTERNAL_KEY;
  if (!expectedKey || internalKey !== expectedKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const result: Record<string, string> = {};
  for (const loc of locations) {
    const onHand = logMap.get(loc.id) ?? 0;
    const reserved = movMap.get(loc.id) ?? 0;
    const available = Math.max(0, onHand - reserved);
    result[loc.name.toLowerCase()] = available > 0 ? "in_stock" : "out";
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
    },
  });
}
