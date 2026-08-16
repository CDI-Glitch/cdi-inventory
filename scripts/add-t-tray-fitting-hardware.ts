/**
 * Add Fitting Kit category hardware to existing T-Tray BOMs.
 * FK / FK-Ex stay constraining. CXH + all TT-BN-* are qty 1, nonConstraining.
 *
 * Run: npx tsx scripts/add-t-tray-fitting-hardware.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { refreshBundleKitsCache } from "../src/lib/bundle-atp";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

const HARDWARE = [
  "CXH",
  "TT-BN-BSG",
  "TT-BN-BX/MG",
  "TT-BN-DNP",
  "TT-BN-FK",
  "TT-BN-FKT",
  "TT-BN-HB",
  "TT-BN-HBL",
];

async function main() {
  const products = await prisma.product.findMany({
    where: { sku: { in: HARDWARE } },
    select: { id: true, sku: true },
  });
  const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));
  const missing = HARDWARE.filter((sku) => !bySku[sku]);
  if (missing.length) throw new Error(`Missing SKUs: ${missing.join(", ")}`);

  const bundles = await prisma.bundleDefinition.findMany({
    where: { code: { startsWith: "BDL-TT-" } },
    include: { items: true },
    orderBy: { code: "asc" },
  });

  for (const bundle of bundles) {
    const maxSort = bundle.items.reduce((m, i) => Math.max(m, i.sortOrder), 0);
    let sort = maxSort + 1;
    let added = 0;

    for (const sku of HARDWARE) {
      const productId = bySku[sku].id;
      const existing = bundle.items.find((i) => i.productId === productId);
      if (existing) {
        await prisma.bundleItem.update({
          where: { id: existing.id },
          data: { qty: 1, nonConstraining: true, componentRole: "hardware_bracket" },
        });
        continue;
      }
      await prisma.bundleItem.create({
        data: {
          bundleId: bundle.id,
          productId,
          qty: 1,
          componentRole: "hardware_bracket",
          required: true,
          sortOrder: sort++,
          nonConstraining: true,
          altGroupKey: null,
        },
      });
      added++;
    }

    await refreshBundleKitsCache(bundle.id);
    console.log(`${bundle.code}  added=${added}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
