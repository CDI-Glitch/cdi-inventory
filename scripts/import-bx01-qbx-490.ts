/**
 * Add BX01-QBX-490-L / BX01-QBX-490-R — Underbody Toolbox for 2100 Service
 * Body, Next Gen Ranger P703 Extra Cab. LHS/RHS x Raw Alloy/Sahara Black/
 * Splash White (6 SKUs). No opening stock.
 *
 * Run: npx tsx scripts/import-bx01-qbx-490.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

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
  for (const side of SIDES) {
    for (const colour of COLOURS) {
      const sku = `BX01-QBX-490-${side.key}${colour.suffix}`;
      const name = `2100 Service Body Next Gen Ranger P703 Underbody Toolbox 490 ${side.label} ${colour.label}`;

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
