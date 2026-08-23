import { prisma } from "./db";
import { getStockForProductLocationPairs } from "./inventory";

export interface LowStockRow {
  id: string;
  sku: string;
  name: string;
  available: number;
  reorderPoint: number;
  locationName: string;
  rowKey: string;
}

export async function getLowStockRows(limit = 5): Promise<LowStockRow[]> {
  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { sku: "asc" },
      take: 50,
    }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const pairs = locations.flatMap((loc) =>
    products.map((p) => ({ productId: p.id, locationId: loc.id }))
  );
  const stockMap = await getStockForProductLocationPairs(pairs);
  const rows: LowStockRow[] = [];
  for (const loc of locations) {
    for (const p of products) {
      const s = stockMap.get(`${p.id}:${loc.id}`) ?? { onHand: 0, reserved: 0, available: 0 };
      if (s.available <= p.reorderPoint && s.onHand > 0) {
        rows.push({
          id: p.id,
          sku: p.sku,
          name: p.name,
          available: s.available,
          reorderPoint: p.reorderPoint,
          locationName: loc.name,
          rowKey: `${p.id}:${loc.id}`,
        });
      }
    }
  }
  return rows.sort((a, b) => a.available - b.available).slice(0, limit);
}

/** Active SKUs with Available < 0 at a warehouse. No aging / sales-record data. */
export async function countShortSkus(locationId?: string): Promise<number> {
  const [products, locations] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { id: true } }),
    prisma.location.findMany({
      where: { active: true, ...(locationId ? { id: locationId } : {}) },
      select: { id: true },
    }),
  ]);
  const pairs = locations.flatMap((loc) =>
    products.map((p) => ({ productId: p.id, locationId: loc.id }))
  );
  const stockMap = await getStockForProductLocationPairs(pairs);
  let count = 0;
  for (const loc of locations) {
    for (const p of products) {
      const s = stockMap.get(`${p.id}:${loc.id}`);
      if (s && s.available < 0) count += 1;
    }
  }
  return count;
}
