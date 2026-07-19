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

export async function getStockMultiLocation(productId: string, reorderPoint: number = 10) {
  const locations = await prisma.location.findMany({ where: { active: true } });
  const results: Record<string, StockSummary> = {};

  for (const loc of locations) {
    results[loc.id] = await getStock(productId, loc.id, reorderPoint);
  }

  return results;
}
