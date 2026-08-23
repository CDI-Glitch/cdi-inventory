import { prisma } from "./db";
import { getStockForProducts } from "./inventory";
import { getAgingReservations, type AgingReservationRow } from "./reservation-aging";

const FORECAST_ELIGIBLE_STATUSES = ["shipped", "in_transit", "arrived"];
const FORECAST_MAX_CONTAINERS = 5;

export const INVENTORY_PAGE_SIZE = 50;
export const MOBILE_INVENTORY_PAGE_SIZE = 20;

export type InventoryStatus = "OK" | "REORDER" | "OUT_OF_STOCK";
export type AlertMode = "all" | "short" | "aging";

export interface InventoryRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  byLocation: Record<string, { onHand: number; reserved: number; available: number }>;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  status: InventoryStatus;
  forecastQtys: number[];
  forecastAvailable: number[];
}

export interface ForecastContainer {
  id: string;
  poRef: string;
  eta: string;
}

export interface InventoryViewResult {
  rows: InventoryRow[];
  containers: ForecastContainer[];
  agingByProductId: Record<string, AgingReservationRow>;
  alertCount: number;
  shortCount: number;
  agingOnlyCount: number;
  currentPage: number;
  totalPages: number;
  forecastActive: boolean;
  backorderActive: boolean;
  incomingOnlyActive: boolean;
  alertMode: AlertMode;
}

export async function buildInventoryView(input: {
  locationId: string;
  locationName: string;
  category?: string;
  search?: string;
  status?: string;
  forecastActive: boolean;
  incomingOnly: boolean;
  backorderActive: boolean;
  alertMode: AlertMode;
  includeAging: boolean;
  page: number;
  pageSize?: number;
}): Promise<InventoryViewResult> {
  const forecastActive = input.forecastActive;
  const backorderActive = input.backorderActive && !forecastActive;
  const includeAging = input.includeAging && backorderActive;
  const pageSize = input.pageSize ?? INVENTORY_PAGE_SIZE;

  const forecastContainersAsc =
    forecastActive && input.locationId
      ? await prisma.incomingShipment.findMany({
          where: {
            locationId: input.locationId,
            status: { in: FORECAST_ELIGIBLE_STATUSES },
            eta: { not: null },
          },
          orderBy: { eta: "asc" },
          take: FORECAST_MAX_CONTAINERS,
          include: { lines: true },
        })
      : [];

  const forecastContainers = [...forecastContainersAsc].reverse();
  const containers: ForecastContainer[] = forecastContainers.map((c) => ({
    id: c.id,
    poRef: c.poRef,
    eta: c.eta!.toISOString(),
  }));

  const forecastQtyMap = new Map<string, number[]>();
  forecastContainers.forEach((container, idx) => {
    const perProduct = new Map<string, number>();
    for (const line of container.lines) {
      perProduct.set(line.productId, (perProduct.get(line.productId) ?? 0) + line.qtyOrdered);
    }
    for (const [productId, qty] of perProduct) {
      if (!forecastQtyMap.has(productId)) {
        forecastQtyMap.set(productId, new Array(containers.length).fill(0));
      }
      forecastQtyMap.get(productId)![idx] = qty;
    }
  });

  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(input.category ? { category: input.category } : {}),
      ...(input.search
        ? {
            OR: [
              { sku: { contains: input.search, mode: "insensitive" } },
              { name: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { sku: "asc" },
  });

  const stockMap = await getStockForProducts(
    input.locationId,
    products.map((p) => p.id)
  );

  const rows: InventoryRow[] = products.map((product) => {
    const stock = stockMap.get(product.id) ?? { onHand: 0, reserved: 0, available: 0 };
    const { onHand, reserved, available } = stock;
    const byLocation = { [input.locationName]: { onHand, reserved, available } };

    let status: InventoryStatus = "OK";
    if (available <= 0) status = "OUT_OF_STOCK";
    else if (available <= product.reorderPoint) status = "REORDER";

    const forecastQtys = forecastQtyMap.get(product.id) ?? new Array(containers.length).fill(0);
    const forecastAvailable: number[] = new Array(forecastQtys.length);
    let cumulative = available;
    for (let i = forecastQtys.length - 1; i >= 0; i--) {
      cumulative += forecastQtys[i];
      forecastAvailable[i] = cumulative;
    }

    return {
      ...product,
      byLocation,
      totalOnHand: onHand,
      totalReserved: reserved,
      totalAvailable: available,
      status,
      forecastQtys,
      forecastAvailable,
    };
  });

  const agingRows = includeAging
    ? await getAgingReservations({ locationId: input.locationId })
    : [];
  const agingByProductId = new Map<string, AgingReservationRow>();
  for (const r of agingRows) {
    const existing = agingByProductId.get(r.productId);
    if (!existing || r.rank > existing.rank || (r.rank === existing.rank && r.ageDays > existing.ageDays)) {
      agingByProductId.set(r.productId, r);
    }
  }

  let filtered =
    backorderActive || !input.status
      ? rows
      : input.status === "IN_STOCK"
        ? rows.filter((r) => r.status !== "OUT_OF_STOCK")
        : rows.filter((r) => r.status === input.status);

  const incomingOnlyActive = forecastActive && input.incomingOnly;
  if (incomingOnlyActive) {
    filtered = filtered.filter((r) => r.forecastQtys.some((qty) => qty > 0));
  }

  if (backorderActive) {
    if (includeAging) {
      filtered = filtered.filter((r) => r.totalAvailable < 0 || agingByProductId.has(r.id));
    } else {
      filtered = filtered.filter((r) => r.totalAvailable < 0);
    }
  }

  const alertCount = backorderActive ? filtered.length : 0;
  const shortCount = backorderActive
    ? filtered.filter((r) => r.totalAvailable < 0).length
    : 0;
  const agingOnlyCount = alertCount - shortCount;

  let alertMode: AlertMode = "all";
  if (backorderActive && includeAging && (input.alertMode === "short" || input.alertMode === "aging")) {
    alertMode = input.alertMode;
  } else if (backorderActive && !includeAging) {
    alertMode = "short";
  }

  if (alertMode === "short") {
    filtered = filtered.filter((r) => r.totalAvailable < 0);
  } else if (alertMode === "aging") {
    filtered = filtered.filter((r) => agingByProductId.get(r.id)?.ageSignal != null);
  }

  const currentPage = Math.max(1, input.page);
  const totalPages = Math.ceil(filtered.length / pageSize);
  const safeTotalPages = Math.max(1, totalPages || 1);
  const page = Math.min(currentPage, safeTotalPages);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    rows: paginated,
    containers,
    agingByProductId: Object.fromEntries(agingByProductId),
    alertCount,
    shortCount,
    agingOnlyCount,
    currentPage: page,
    totalPages,
    forecastActive,
    backorderActive,
    incomingOnlyActive,
    alertMode,
  };
}
