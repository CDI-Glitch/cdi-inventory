/**
 * Add BX01-1600 / 1609 / 1800 / 1809 underbody toolbox SKUs.
 * LHS/RHS × Raw Alloy / Sahara Black / Splash White (24 SKUs). No opening stock.
 *
 * Run: npx tsx scripts/import-bx01-1600-1800.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SIZES = ["1600", "1609", "1800", "1809"] as const;

const SIDES = [
  { key: "L", label: "LHS" },
  { key: "R", label: "RHS" },
] as const;

const COLOURS = [
  { suffix: "", label: "Raw Alloy" },
  { suffix: "-SHB", label: "Sahara Black" },
  { suffix: "-W", label: "Splash White" },
] as const;

async function main() {
  for (const size of SIZES) {
    for (const side of SIDES) {
      for (const colour of COLOURS) {
        const sku = `BX01-${size}-${side.key}${colour.suffix}`;
        const name = `C-Profile Underbody Toolbox ${size} ${side.label} ${colour.label}`;

        const existing = await prisma.product.findUnique({ where: { sku } });
        if (existing) {
          console.log(`SKIP (exists): ${sku}`);
          continue;
        }

        const product = await prisma.product.create({
          data: {
            sku,
            name,
            category: "UNDERBODY_TOOLBOX",
            unit: "Each",
            reorderPoint: 5,
            active: true,
          },
        });

        console.log(`✅ ${product.sku} | ${product.name} | reorder: ${product.reorderPoint} | qty: 0`);
      }
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
