/**
 * Remove FK-Ex from all T-Tray BOMs, then refresh kits (and push if Shopify creds exist).
 * Product FK-Ex stays in inventory; add via fulfillment when a job actually needs it.
 *
 * Run: npx tsx scripts/remove-t-tray-fk-ex.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { refreshBundleKitsCache } from "../src/lib/bundle-atp";
import { syncBundleToShopify } from "../src/lib/shopify-sync";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

async function main() {
  const fkEx = await prisma.product.findUnique({ where: { sku: "FK-Ex" } });
  if (!fkEx) throw new Error("Product FK-Ex not found");

  const bundles = await prisma.bundleDefinition.findMany({
    where: { code: { startsWith: "BDL-TT-" } },
    select: { id: true, code: true, shopifyInventoryItemId: true },
  });
  const bundleIds = bundles.map((b) => b.id);

  const deleted = await prisma.bundleItem.deleteMany({
    where: { bundleId: { in: bundleIds }, productId: fkEx.id },
  });
  console.log(`Removed ${deleted.count} FK-Ex bundle lines from ${bundles.length} T-Tray bundles`);

  for (const bundle of bundles) {
    await refreshBundleKitsCache(bundle.id);
    if (bundle.shopifyInventoryItemId) {
      try {
        await syncBundleToShopify(bundle.id);
        console.log(`${bundle.code}  kits refreshed + Shopify pushed`);
      } catch (err) {
        console.log(`${bundle.code}  kits refreshed (Shopify push skipped: ${(err as Error).message})`);
      }
    } else {
      console.log(`${bundle.code}  kits refreshed (no Shopify binding)`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
