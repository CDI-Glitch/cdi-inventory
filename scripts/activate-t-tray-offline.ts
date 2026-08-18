/**
 * Mark T-Tray Portal bundles active even without Shopify sellableSku.
 * Run: npx tsx scripts/activate-t-tray-offline.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

const CODES = [
  "BDL-TT-1650-RAW",
  "BDL-TT-1850-RAW",
  "BDL-TT-2150-RAW",
  "BDL-TT-2150-SHB",
  "BDL-TT-2150-W",
  "BDL-TT-2450-RAW",
];

async function main() {
  const result = await prisma.bundleDefinition.updateMany({
    where: { code: { in: CODES } },
    data: { active: true },
  });
  console.log(`Activated ${result.count} bundles`);
  const rows = await prisma.bundleDefinition.findMany({
    where: { code: { startsWith: "BDL-TT-" } },
    select: { code: true, active: true, sellableSku: true },
    orderBy: { code: "asc" },
  });
  for (const row of rows) {
    console.log(`${row.code}  active=${row.active}  sellableSku=${row.sellableSku ?? "-"}`);
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
