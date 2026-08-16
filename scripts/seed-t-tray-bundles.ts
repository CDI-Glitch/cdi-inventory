/**
 * Upsert 12 T-Tray sellable bundles (4 sizes × 3 colours).
 * Shopify inventory/variant IDs stay empty until bound in the Portal.
 *
 * Run: npx tsx scripts/seed-t-tray-bundles.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { refreshBundleKitsCache } from "../src/lib/bundle-atp";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

type Colour = { key: "silver" | "black" | "white"; suffix: string; label: string };

const COLOURS: Colour[] = [
  { key: "silver", suffix: "", label: "Raw Alloy" },
  { key: "black", suffix: "-SHB", label: "Sahara Black" },
  { key: "white", suffix: "-W", label: "Splash White" },
];

const SIZES = [
  { size: "1650", cab: "16DC", deck: "1605", bar: "TT-BSG-67", box: "TT-BX-68", fk: 3 },
  { size: "1850", cab: "18DC", deck: "1805", bar: "TT-BSG-89", box: "TT-BX-90", fk: 3 },
  { size: "2150", cab: "21EC", deck: "2105", bar: "TT-BSG-89", box: "TT-BX-90", fk: 3 },
  { size: "2450", cab: "24SC", deck: "2405", bar: "TT-BSG-67", box: "TT-BX-68", fk: 4 },
] as const;

/** Currently live on Shopify: black/white for 16DC, 18DC, 24SC only. */
const LIVE_SELLABLE: Record<string, string> = {
  "BDL-TT-1650-SHB": "BND-T-TRAY-16DC-HB-SHB",
  "BDL-TT-1650-W": "BND-T-TRAY-16DC-HB-W",
  "BDL-TT-1850-SHB": "BND-T-TRAY-18DC-HB-SHB",
  "BDL-TT-1850-W": "BND-T-TRAY-18DC-HB-W",
  "BDL-TT-2450-SHB": "BND-T-TRAY-24SC-HB-SHB",
  "BDL-TT-2450-W": "BND-T-TRAY-24SC-HB-W",
};

function withColour(base: string, suffix: string) {
  return `${base}${suffix}`;
}

async function requireProduct(sku: string) {
  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) throw new Error(`Missing product SKU: ${sku}`);
  return product;
}

async function main() {
  for (const size of SIZES) {
    for (const colour of COLOURS) {
      const code = `BDL-TT-${size.size}${colour.suffix || "-RAW"}`;
      const sellableSku = LIVE_SELLABLE[code] ?? null;
      const name = `T-Tray ${size.size} ${size.cab} + HB ${colour.label}`;

      const skus = [
        withColour(`T-Tray-${size.deck}`, colour.suffix),
        withColour("TT-HB", colour.suffix),
        withColour("CD-MG", colour.suffix),
        withColour("CD-MG-DT", colour.suffix),
        withColour("CD-MG-HR", colour.suffix),
        withColour(size.bar, colour.suffix),
        withColour(`${size.box}-L`, colour.suffix),
        withColour(`${size.box}-R`, colour.suffix),
        "FK",
        "FK-Ex",
        withColour("TT-PZB", colour.suffix),
        withColour("TT-WDB", colour.suffix),
      ];

      const products = [];
      for (const sku of skus) products.push(await requireProduct(sku));
      const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));

      const items = [
        { sku: skus[0], qty: 1, componentRole: "main_body", altGroupKey: null },
        { sku: skus[1], qty: 1, componentRole: "body_attachment", altGroupKey: null },
        { sku: skus[2], qty: 1, componentRole: "tray_mount", altGroupKey: "mudguard" },
        { sku: skus[3], qty: 1, componentRole: "tray_mount", altGroupKey: "mudguard" },
        { sku: skus[4], qty: 1, componentRole: "tray_mount", altGroupKey: "mudguard" },
        { sku: skus[5], qty: 1, componentRole: "tray_mount", altGroupKey: null },
        { sku: skus[6], qty: 1, componentRole: "body_attachment", altGroupKey: null },
        { sku: skus[7], qty: 1, componentRole: "body_attachment", altGroupKey: null },
        { sku: "FK", qty: size.fk, componentRole: "hardware_bracket", altGroupKey: null },
        { sku: "FK-Ex", qty: 1, componentRole: "hardware_bracket", altGroupKey: null },
        { sku: skus[10], qty: 1, componentRole: "body_attachment", altGroupKey: null },
        { sku: skus[11], qty: 1, componentRole: "body_attachment", altGroupKey: null },
      ];

      const existing = await prisma.bundleDefinition.findUnique({ where: { code } });
      const payload = {
        name,
        productFamily: "T_TRAY",
        active: Boolean(sellableSku),
        sellableSku,
      };

      const bundle = existing
        ? await prisma.bundleDefinition.update({ where: { id: existing.id }, data: payload })
        : await prisma.bundleDefinition.create({ data: { code, ...payload } });

      await prisma.bundleItem.deleteMany({ where: { bundleId: bundle.id } });
      await prisma.bundleItem.createMany({
        data: items.map((item, idx) => ({
          bundleId: bundle.id,
          productId: bySku[item.sku].id,
          qty: item.qty,
          componentRole: item.componentRole,
          required: true,
          sortOrder: idx,
          nonConstraining: false,
          altGroupKey: item.altGroupKey,
        })),
      });

      await refreshBundleKitsCache(bundle.id);
      console.log(`OK ${code}  sellableSku=${sellableSku}`);
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
