import { prisma } from "./db";

export interface StockSummary {
  onHand: number;
  reserved: number;
  available: number;
  status: "OK" | "REORDER" | "OUT_OF_STOCK";
}

export async function getStock(
  productId: string,
  locationId: string,
  reorderPoint: number = 10
): Promise<StockSummary> {
  const [onHandResult, reservedResult] = await Promise.all([
    prisma.inventoryLog.aggregate({
      where: { productId, locationId },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.aggregate({
      where: { productId, locationId, reservedQty: { gt: 0 } },
      _sum: { reservedQty: true },
    }),
  ]);

  const onHand = onHandResult._sum.delta ?? 0;
  const reserved = reservedResult._sum.reservedQty ?? 0;
  const available = onHand - reserved;

  let status: StockSummary["status"] = "OK";
  if (available <= 0) status = "OUT_OF_STOCK";
  else if (available <= reorderPoint) status = "REORDER";

  return { onHand, reserved, available, status };
}

export interface StockCounts {
  onHand: number;
  reserved: number;
  available: number;
}

export async function getStockForProducts(
  locationId: string,
  productIds: string[]
): Promise<Map<string, StockCounts>> {
  const result = new Map<string, StockCounts>();
  const unique = [...new Set(productIds.filter(Boolean))];
  if (!locationId || unique.length === 0) return result;

  const [logs, reserved] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["productId"],
      where: { locationId, productId: { in: unique } },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["productId"],
      where: { locationId, productId: { in: unique }, reservedQty: { gt: 0 } },
      _sum: { reservedQty: true },
    }),
  ]);

  const onHandMap = new Map(logs.map((l) => [l.productId, l._sum.delta ?? 0]));
  const reservedMap = new Map(reserved.map((r) => [r.productId, r._sum.reservedQty ?? 0]));
  for (const id of unique) {
    const onHand = onHandMap.get(id) ?? 0;
    const reservedQty = reservedMap.get(id) ?? 0;
    result.set(id, { onHand, reserved: reservedQty, available: onHand - reservedQty });
  }
  return result;
}

export async function getStockForProductLocationPairs(
  pairs: { productId: string; locationId: string }[]
): Promise<Map<string, StockCounts>> {
  const result = new Map<string, StockCounts>();
  const unique = Array.from(
    new Map(pairs.map((p) => [`${p.productId}:${p.locationId}`, p])).values()
  ).filter((p) => p.productId && p.locationId);
  if (unique.length === 0) return result;

  const productIds = [...new Set(unique.map((p) => p.productId))];
  const locationIds = [...new Set(unique.map((p) => p.locationId))];

  const [logs, reserved] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["productId", "locationId"],
      where: { productId: { in: productIds }, locationId: { in: locationIds } },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["productId", "locationId"],
      where: {
        productId: { in: productIds },
        locationId: { in: locationIds },
        reservedQty: { gt: 0 },
      },
      _sum: { reservedQty: true },
    }),
  ]);

  const onHandMap = new Map(logs.map((l) => [`${l.productId}:${l.locationId}`, l._sum.delta ?? 0]));
  const reservedMap = new Map(
    reserved.map((r) => [`${r.productId}:${r.locationId}`, r._sum.reservedQty ?? 0])
  );
  for (const p of unique) {
    const key = `${p.productId}:${p.locationId}`;
    const onHand = onHandMap.get(key) ?? 0;
    const reservedQty = reservedMap.get(key) ?? 0;
    result.set(key, { onHand, reserved: reservedQty, available: onHand - reservedQty });
  }
  return result;
}

export async function getStockMultiLocation(productId: string, reorderPoint: number = 10) {
  const locations = await prisma.location.findMany({ where: { active: true } });
  const results: Record<string, StockSummary> = {};

  for (const loc of locations) {
    results[loc.id] = await getStock(productId, loc.id, reorderPoint);
  }

  return results;
}
