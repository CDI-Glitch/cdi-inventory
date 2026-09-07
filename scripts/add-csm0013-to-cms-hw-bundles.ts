/**
 * One-off: add CSM0013 (挡泥皮) as a nonConstraining component (qty 2) to the
 * two CMS Hardware Kit shortcut bundles, without touching their existing
 * BundleItem rows (these bundles have no sellableSku, not pushed to Shopify).
 *
 * Run: npx tsx scripts/add-csm0013-to-cms-hw-bundles.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { refreshBundleKitsCache } from "../src/lib/bundle-atp";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const BUNDLE_CODES = ["BDL-CMS-HW-DUALCAB", "BDL-CMS-HW-SINGLECAB"];

async function main() {
  const product = await prisma.product.findUnique({ where: { sku: "CSM0013" } });
  if (!product) throw new Error("Missing product SKU: CSM0013");
  if (product.category !== "FITTING_KIT") {
    throw new Error(
      `CSM0013 category is ${product.category}, expected FITTING_KIT. Run recategorize-csm0013-fitting-kit.ts first.`
    );
  }

  for (const code of BUNDLE_CODES) {
    const bundle = await prisma.bundleDefinition.findUnique({
      where: { code },
      include: { items: true },
    });
    if (!bundle) throw new Error(`Missing bundle ${code}`);

    const already = bundle.items.find((i) => i.productId === product.id);
    if (already) {
      console.log(`Skip (already present): ${code}`);
      continue;
    }

    const maxSort = bundle.items.reduce((m, i) => Math.max(m, i.sortOrder), -1);

    await prisma.bundleItem.create({
      data: {
        bundleId: bundle.id,
        productId: product.id,
        qty: 2,
        componentRole: "hardware_bracket",
        required: true,
        sortOrder: maxSort + 1,
        nonConstraining: true,
        altGroupKey: null,
      },
    });

    await refreshBundleKitsCache(bundle.id);
    console.log(`OK ${code} — added CSM0013 x2 (nonConstraining)`);
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
