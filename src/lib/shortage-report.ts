import { prisma } from "./db";

// Same eligibility Forecast Mode and aging reservations use: on the way, ETA known.
const INCOMING_ELIGIBLE_STATUSES = ["shipped", "in_transit", "arrived"];

export interface ShortageRow {
  sku: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  reserved: number;
  shortQty: number;
  nearestIncoming: {
    poRef: string;
    eta: string;
    qtyOrdered: number;
  } | null;
}

function formatCategory(category: string) {
  if (category === "12V") return "12V";
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Factory-facing shortage list for one warehouse: active SKUs where
 * Available = On Hand − Reserved is negative. No customer / sales / age fields.
 */
export async function getShortageRows(locationId: string): Promise<ShortageRow[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, sku: true, name: true, category: true, unit: true },
    orderBy: [{ category: "asc" }, { sku: "asc" }],
  });

  if (products.length === 0) return [];

  const [logs, reserved] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["productId"],
      where: { locationId },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["productId"],
      where: { locationId, reservedQty: { gt: 0 } },
      _sum: { reservedQty: true },
    }),
  ]);

  const onHandMap = new Map(logs.map((l) => [l.productId, l._sum.delta ?? 0]));
  const reservedMap = new Map(reserved.map((r) => [r.productId, r._sum.reservedQty ?? 0]));

  const shortProducts = products
    .map((p) => {
      const onHand = onHandMap.get(p.id) ?? 0;
      const reservedQty = reservedMap.get(p.id) ?? 0;
      const available = onHand - reservedQty;
      return { p, onHand, reservedQty, available, shortQty: Math.max(0, reservedQty - onHand) };
    })
    .filter((r) => r.available < 0);

  if (shortProducts.length === 0) return [];

  const shortIds = new Set(shortProducts.map((r) => r.p.id));
  const shipments = await prisma.incomingShipment.findMany({
    where: {
      locationId,
      status: { in: INCOMING_ELIGIBLE_STATUSES },
      eta: { not: null },
    },
    orderBy: { eta: "asc" },
    include: { lines: true },
  });

  const nearestIncomingMap = new Map<string, ShortageRow["nearestIncoming"]>();
  for (const container of shipments) {
    if (!container.eta) continue;
    const qtyByProduct = new Map<string, number>();
    for (const line of container.lines) {
      if (!shortIds.has(line.productId)) continue;
      qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.qtyOrdered);
    }
    for (const [productId, qtyOrdered] of qtyByProduct) {
      if (nearestIncomingMap.has(productId)) continue;
      nearestIncomingMap.set(productId, {
        poRef: container.poRef,
        eta: container.eta.toISOString(),
        qtyOrdered,
      });
    }
  }

  return shortProducts.map(({ p, onHand, reservedQty, shortQty }) => ({
    sku: p.sku,
    name: p.name,
    category: formatCategory(p.category),
    unit: p.unit,
    onHand,
    reserved: reservedQty,
    shortQty,
    nearestIncoming: nearestIncomingMap.get(p.id) ?? null,
  }));
}
