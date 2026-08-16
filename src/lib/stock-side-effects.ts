import { findBundleIdsUsingProducts, refreshBundleKitsCache } from "./bundle-atp";
import { syncBundleToShopify, syncProductToShopify } from "./shopify-sync";
import { prisma } from "./db";

/**
 * After on-hand or reserved qty changes for one or more products:
 * push those SKUs to Shopify (if linked) and refresh + push every sellable
 * bundle that uses them. Failures are logged; callers should not fail the
 * originating write.
 */
export async function afterStockChange(productIds: string[]): Promise<void> {
  const unique = [...new Set(productIds.filter(Boolean))];
  if (unique.length === 0) return;

  const locations = await prisma.location.findMany({
    where: { active: true },
    select: { id: true },
  });

  for (const productId of unique) {
    for (const loc of locations) {
      try {
        await syncProductToShopify(productId, loc.id);
      } catch (err) {
        console.error(`[afterStockChange] product sync failed ${productId}@${loc.id}`, err);
      }
    }
  }

  const bundleIds = await findBundleIdsUsingProducts(unique);
  for (const bundleId of bundleIds) {
    try {
      await refreshBundleKitsCache(bundleId);
      await syncBundleToShopify(bundleId);
    } catch (err) {
      console.error(`[afterStockChange] bundle sync failed ${bundleId}`, err);
    }
  }
}

export function scheduleAfterStockChange(productIds: string[]): void {
  void afterStockChange(productIds).catch((err) => {
    console.error("[afterStockChange] unhandled", err);
  });
}
