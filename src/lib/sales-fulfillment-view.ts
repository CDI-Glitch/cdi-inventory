import { listAltGroupTasks, type AltGroupTask, type LineLike, type MovementLike } from "./alt-group-fulfillment";

export type BundleComponent = {
  sku: string;
  name: string;
  qty: number;
};

export type LiveBundleMap = Record<string, { name: string; items: BundleComponent[] }>;

export type FulfillmentDisplayRow = {
  id: string;
  sku: string;
  name: string;
  locationName: string;
  qty: number;
};

type MovementRow = MovementLike & {
  id: string;
  product: { sku: string; name: string };
  location: { name: string };
};

type DeductionRow = {
  id: string;
  delta: number;
  product: { sku: string; name: string };
  location: { name: string };
};

type LineRow = LineLike & { itemCode: string };

export function getBundleComponents(
  line: { itemCode: string; snapshotItems: unknown },
  liveBundles: LiveBundleMap
): BundleComponent[] {
  const snapshot = line.snapshotItems as BundleComponent[] | null;
  if (Array.isArray(snapshot) && snapshot.length > 0) {
    return snapshot.map((item) => ({
      sku: item.sku,
      name: item.name,
      qty: item.qty,
    }));
  }
  return liveBundles[line.itemCode]?.items ?? [];
}

export function buildOrderLineQtyMap(
  lines: LineRow[],
  liveBundles: LiveBundleMap
): Record<string, number> {
  const orderLineMap: Record<string, number> = {};
  for (const line of lines) {
    if (line.lineType === "sku") {
      orderLineMap[line.itemCode] = (orderLineMap[line.itemCode] ?? 0) + line.qty;
    } else if (line.lineType === "bundle") {
      for (const item of getBundleComponents(line, liveBundles)) {
        orderLineMap[item.sku] = (orderLineMap[item.sku] ?? 0) + item.qty * line.qty;
      }
    }
  }
  return orderLineMap;
}

export function isSkuMismatch(
  orderLineMap: Record<string, number>,
  sku: string,
  fulfillmentQty: number
): boolean {
  const orderedQty = orderLineMap[sku];
  return orderedQty === undefined || orderedQty !== fulfillmentQty;
}

export function aggregateFulfillmentRows(movements: MovementRow[]): FulfillmentDisplayRow[] {
  const bySku = new Map<string, FulfillmentDisplayRow>();
  for (const mov of movements) {
    if (mov.reservedQty <= 0) continue;
    const existing = bySku.get(mov.product.sku);
    if (existing) {
      existing.qty += mov.reservedQty;
    } else {
      bySku.set(mov.product.sku, {
        id: mov.id,
        sku: mov.product.sku,
        name: mov.product.name,
        locationName: mov.location.name,
        qty: mov.reservedQty,
      });
    }
  }
  return Array.from(bySku.values());
}

export function aggregateDeductionRows(logs: DeductionRow[]): FulfillmentDisplayRow[] {
  const bySku = new Map<string, FulfillmentDisplayRow>();
  for (const log of logs) {
    const qty = Math.abs(log.delta);
    const existing = bySku.get(log.product.sku);
    if (existing) {
      existing.qty += qty;
    } else {
      bySku.set(log.product.sku, {
        id: log.id,
        sku: log.product.sku,
        name: log.product.name,
        locationName: log.location.name,
        qty,
      });
    }
  }
  return Array.from(bySku.values());
}

export type FulfillmentView = {
  orderLineMap: Record<string, number>;
  fulfillmentRows: FulfillmentDisplayRow[];
  deductionRows: FulfillmentDisplayRow[];
  altGroupTasks: AltGroupTask[];
  packlistRows: FulfillmentDisplayRow[];
  hasAnyFulfillmentMismatch: boolean;
  hasAnyDeductionMismatch: boolean;
};

export function buildFulfillmentView(input: {
  status: string;
  lines: LineRow[];
  movements: MovementRow[];
  liveBundles: LiveBundleMap;
  deductions: DeductionRow[];
}): FulfillmentView {
  const orderLineMap = buildOrderLineQtyMap(input.lines, input.liveBundles);
  const fulfillmentRows = aggregateFulfillmentRows(input.movements);
  const deductionRows = aggregateDeductionRows(input.deductions);
  const altGroupTasks =
    input.status === "deposit_paid" || input.status === "fully_paid"
      ? listAltGroupTasks(input.lines, input.movements)
      : [];

  return {
    orderLineMap,
    fulfillmentRows,
    deductionRows,
    altGroupTasks,
    packlistRows: input.status === "completed" ? deductionRows : fulfillmentRows,
    hasAnyFulfillmentMismatch: fulfillmentRows.some((r) =>
      isSkuMismatch(orderLineMap, r.sku, r.qty)
    ),
    hasAnyDeductionMismatch: deductionRows.some((r) =>
      isSkuMismatch(orderLineMap, r.sku, r.qty)
    ),
  };
}
