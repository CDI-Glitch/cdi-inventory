/**
 * Add dogbox canopy variants for 1600mm and 1800mm widths:
 *  - CD-3DB-17188  — Half Dogbox Driver Side, 1775 x 1800 x 850
 *  - CD-4DB-17168  — Full Dogbox,             1775 x 1600 x 850
 *  - CD-4DB-17188  — Full Dogbox,             1775 x 1800 x 850
 * (CD-3DB-17168 already added separately.)
 * 3 colours each (Raw Alloy / Sahara Black / Splash White). No opening stock.
 *
 * Run: npx tsx scripts/import-cd-dogbox-1600-1800.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const COLOURS = [
  { suffix: "", label: "Raw Alloy" },
  { suffix: "-SHB", label: "Sahara Black" },
  { suffix: "-W", label: "Splash White" },
] as const;

const VARIANTS = [
  { code: "CD-3DB-17188", dims: "1775 x 1800 x 850", feature: "Half Dogbox Driver Side" },
  { code: "CD-4DB-17168", dims: "1775 x 1600 x 850", feature: "Full Dogbox" },
  { code: "CD-4DB-17188", dims: "1775 x 1800 x 850", feature: "Full Dogbox" },
] as const;

async function main() {
  for (const variant of VARIANTS) {
    for (const colour of COLOURS) {
      const sku = `${variant.code}${colour.suffix}`;
      const name = `3 Door Base Canopy ${variant.dims} ${variant.feature} ${colour.label}`.replace(
        "3 Door",
        variant.code.startsWith("CD-4DB") ? "4 Door" : "3 Door"
      );

      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        console.log(`SKIP (exists): ${sku}`);
        continue;
      }

      const product = await prisma.product.create({
        data: {
          sku,
          name,
          category: "CANOPY",
          unit: "Each",
          reorderPoint: 2,
          active: true,
        },
      });

      console.log(`✅ ${product.sku} | ${product.name} | reorder: ${product.reorderPoint} | qty: 0`);
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
