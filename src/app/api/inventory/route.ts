import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const statusFilter = searchParams.get("status");
  const search = searchParams.get("search");

  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { sku: "asc" },
  });

  const locations = await prisma.location.findMany({ where: { active: true } });

  // Batch fetch all inventory logs and movements
  const [allLogs, allMovements] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["productId", "locationId"],
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["productId", "locationId"],
      where: { reservedQty: { gt: 0 } },
      _sum: { reservedQty: true },
    }),
  ]);

  const logMap = new Map<string, number>();
  for (const log of allLogs) {
    logMap.set(`${log.productId}:${log.locationId}`, log._sum.delta ?? 0);
  }

  const movMap = new Map<string, number>();
  for (const mov of allMovements) {
    movMap.set(`${mov.productId}:${mov.locationId}`, mov._sum.reservedQty ?? 0);
  }

  const rows = products.map((product) => {
    const byLocation: Record<string, { onHand: number; reserved: number; available: number }> = {};
    let totalOnHand = 0;
    let totalReserved = 0;

    for (const loc of locations) {
      const onHand = logMap.get(`${product.id}:${loc.id}`) ?? 0;
      const reserved = movMap.get(`${product.id}:${loc.id}`) ?? 0;
      const available = onHand - reserved;
      byLocation[loc.name] = { onHand, reserved, available };
      totalOnHand += onHand;
      totalReserved += reserved;
    }

    const totalAvailable = totalOnHand - totalReserved;
    let status: "OK" | "REORDER" | "OUT_OF_STOCK" = "OK";
    if (totalAvailable <= 0) status = "OUT_OF_STOCK";
    else if (totalAvailable <= product.reorderPoint) status = "REORDER";

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit,
      reorderPoint: product.reorderPoint,
      byLocation,
      totalOnHand,
      totalReserved,
      totalAvailable,
      status,
    };
  });

  const filtered = statusFilter
    ? rows.filter((r) => r.status === statusFilter)
    : rows;

  return NextResponse.json({ products: filtered, locations: locations.map((l) => l.name) });
}
