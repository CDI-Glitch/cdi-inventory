/**
 * Add CD-3DB-17168 — 3 Door Base Canopy 1775 x 1600 x 850, Half Dogbox
 * Driver Side variant. Raw Alloy / Sahara Black / Splash White. No opening
 * stock.
 *
 * Run: npx tsx scripts/import-cd-3db-17168.ts
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

async function main() {
  for (const colour of COLOURS) {
    const sku = `CD-3DB-17168${colour.suffix}`;
    const name = `3 Door Base Canopy 1775 x 1600 x 850 Half Dogbox Driver Side ${colour.label}`;

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

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
