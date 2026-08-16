import { prisma } from "./db";

export type BundleKitGroup = {
  key: string;
  productIds: string[];
  skus: string[];
  available: number;
  qtyPerKit: number;
  kitsFromGroup: number;
};

export type BundleKitsResult = {
  kits: number;
  groups: BundleKitGroup[];
};

type BundleItemRow = {
  productId: string;
  qty: number;
  required: boolean;
  nonConstraining: boolean;
  altGroupKey: string | null;
  product: { sku: string; active: boolean };
};

function availableFor(productId: string, locationId: string, onHand: Map<string, number>, reserved: Map<string, number>) {
  const key = `${productId}:${locationId}`;
  return (onHand.get(key) ?? 0) - (reserved.get(key) ?? 0);
}

function groupItems(items: BundleItemRow[]): { key: string; items: BundleItemRow[] }[] {
  const map = new Map<string, BundleItemRow[]>();
  let anon = 0;
  for (const item of items) {
    if (item.nonConstraining) continue;
    if (!item.required) continue;
    const key = item.altGroupKey?.trim() || `__line_${anon++}`;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, grouped]) => ({ key, items: grouped }));
}

async function loadAvailability(productIds: string[], locationId: string) {
  const [logs, movements] = await Promise.all([
    prisma.inventoryLog.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, locationId },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, locationId, reservedQty: { gt: 0 } },
      _sum: { reservedQty: true },
    }),
  ]);

  const onHand = new Map<string, number>();
  const reserved = new Map<string, number>();
  for (const row of logs) onHand.set(`${row.productId}:${locationId}`, row._sum.delta ?? 0);
  for (const row of movements) reserved.set(`${row.productId}:${locationId}`, row._sum.reservedQty ?? 0);
  return { onHand, reserved };
}

export async function calcBundleKits(
  bundleDefinitionId: string,
  locationId: string
): Promise<BundleKitsResult> {
  const bundle = await prisma.bundleDefinition.findUniqueOrThrow({
    where: { id: bundleDefinitionId },
    include: { items: { include: { product: { select: { sku: true, active: true } } } } },
  });

  return calcBundleKitsFromItems(bundle.items, locationId);
}

export async function calcBundleKitsFromItems(
  items: BundleItemRow[],
  locationId: string
): Promise<BundleKitsResult> {
  const groups = groupItems(items);
  if (groups.length === 0) {
    return { kits: 0, groups: [] };
  }

  const productIds = [...new Set(groups.flatMap((g) => g.items.map((i) => i.productId)))];
  const { onHand, reserved } = await loadAvailability(productIds, locationId);

  const computed: BundleKitGroup[] = groups.map((g) => {
    const qtyPerKit = g.items[0]?.qty ?? 1;
    const available = g.items.reduce(
      (sum, item) => sum + availableFor(item.productId, locationId, onHand, reserved),
      0
    );
    const kitsFromGroup = qtyPerKit > 0 ? Math.floor(Math.max(0, available) / qtyPerKit) : 0;
    return {
      key: g.key,
      productIds: g.items.map((i) => i.productId),
      skus: g.items.map((i) => i.product.sku),
      available,
      qtyPerKit,
      kitsFromGroup,
    };
  });

  const kits = computed.reduce((min, g) => Math.min(min, g.kitsFromGroup), Number.POSITIVE_INFINITY);
  return { kits: Number.isFinite(kits) ? kits : 0, groups: computed };
}

export async function refreshBundleKitsCache(bundleDefinitionId: string): Promise<void> {
  const locations = await prisma.location.findMany({ where: { active: true }, select: { id: true } });
  for (const loc of locations) {
    const { kits } = await calcBundleKits(bundleDefinitionId, loc.id);
    await prisma.bundleLocationStock.upsert({
      where: {
        bundleDefinitionId_locationId: { bundleDefinitionId, locationId: loc.id },
      },
      create: { bundleDefinitionId, locationId: loc.id, cachedKits: kits },
      update: { cachedKits: kits },
    });
  }
}

export async function findBundleIdsUsingProducts(productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return [];
  const items = await prisma.bundleItem.findMany({
    where: { productId: { in: productIds } },
    select: { bundleId: true },
    distinct: ["bundleId"],
  });
  return items.map((i) => i.bundleId);
}

export type SharedBottleneckAlert = {
  locationId: string;
  locationName: string;
  key: string;
  skus: string[];
  available: number;
  kitsFromGroup: number;
  bundleCodes: string[];
  bundleNames: string[];
};

export async function findSharedComponentBottlenecks(): Promise<SharedBottleneckAlert[]> {
  const [locations, bundles] = await Promise.all([
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.bundleDefinition.findMany({
      where: { active: true, sellableSku: { not: null } },
      include: { items: { include: { product: { select: { sku: true, active: true } } } } },
    }),
  ]);

  const alerts: SharedBottleneckAlert[] = [];

  for (const loc of locations) {
    const byKey = new Map<
      string,
      { skus: string[]; available: number; kitsFromGroup: number; bundleCodes: string[]; bundleNames: string[] }
    >();

    for (const bundle of bundles) {
      const result = await calcBundleKitsFromItems(bundle.items, loc.id);
      if (result.groups.length === 0) continue;
      for (const group of result.groups) {
        if (group.kitsFromGroup !== result.kits) continue;
        const identity = [...group.productIds].sort().join(",");
        const existing = byKey.get(identity);
        if (!existing) {
          byKey.set(identity, {
            skus: group.skus,
            available: group.available,
            kitsFromGroup: group.kitsFromGroup,
            bundleCodes: [bundle.code],
            bundleNames: [bundle.name],
          });
        } else {
          existing.bundleCodes.push(bundle.code);
          existing.bundleNames.push(bundle.name);
        }
      }
    }

    for (const [key, row] of byKey) {
      if (row.bundleCodes.length < 2) continue;
      alerts.push({
        locationId: loc.id,
        locationName: loc.name,
        key,
        skus: row.skus,
        available: row.available,
        kitsFromGroup: row.kitsFromGroup,
        bundleCodes: row.bundleCodes,
        bundleNames: row.bundleNames,
      });
    }
  }

  return alerts;
}

export function snapshotBundleItems(
  items: {
    productId: string;
    qty: number;
    nonConstraining: boolean;
    altGroupKey: string | null;
    product: { sku: string; name: string };
  }[]
) {
  return items.map((i) => ({
    productId: i.productId,
    sku: i.product.sku,
    name: i.product.name,
    qty: i.qty,
    nonConstraining: i.nonConstraining,
    altGroupKey: i.altGroupKey,
  }));
}
