import { prisma } from "./db";
import { getStockForProductLocationPairs } from "./inventory";

export type FullExportStatus = "OK" | "REORDER" | "OUT_OF_STOCK";

export interface FullExportRow {
  sku: string;
  name: string;
  category: string;
  unit: string;
  reorderPoint: number;
  byLocation: Record<string, { onHand: number; reserved: number; available: number }>;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  status: FullExportStatus;
}

export interface FullInventoryExport {
  rows: FullExportRow[];
  locationNames: string[];
}

function formatCategory(category: string) {
  if (category === "12V") return "12V";
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stockStatus(available: number, reorderPoint: number): FullExportStatus {
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= reorderPoint) return "REORDER";
  return "OK";
}

export async function getFullInventoryExportRows(): Promise<FullInventoryExport> {
  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        unit: true,
        reorderPoint: true,
      },
      orderBy: [{ category: "asc" }, { sku: "asc" }],
    }),
    prisma.location.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const locationNames = locations.map((l) => l.name);
  if (products.length === 0) {
    return { rows: [], locationNames };
  }

  const pairs = products.flatMap((p) =>
    locations.map((l) => ({ productId: p.id, locationId: l.id }))
  );
  const stockMap = await getStockForProductLocationPairs(pairs);

  const rows: FullExportRow[] = products.map((product) => {
    const byLocation: FullExportRow["byLocation"] = {};
    let totalOnHand = 0;
    let totalReserved = 0;

    for (const loc of locations) {
      const stock = stockMap.get(`${product.id}:${loc.id}`) ?? {
        onHand: 0,
        reserved: 0,
        available: 0,
      };
      byLocation[loc.name] = stock;
      totalOnHand += stock.onHand;
      totalReserved += stock.reserved;
    }

    const totalAvailable = totalOnHand - totalReserved;
    return {
      sku: product.sku,
      name: product.name,
      category: formatCategory(product.category),
      unit: product.unit,
      reorderPoint: product.reorderPoint,
      byLocation,
      totalOnHand,
      totalReserved,
      totalAvailable,
      status: stockStatus(totalAvailable, product.reorderPoint),
    };
  });

  return { rows, locationNames };
}
