/**
 * Point live T-Tray bundles at the Shopify variant SKUs currently on the store.
 * Run: npx tsx scripts/apply-t-tray-sellable-skus.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const LIVE: Record<string, { sellableSku: string; name: string }> = {
  "BDL-TT-1650-SHB": {
    sellableSku: "BDL-TT-1650-SHB",
    name: "T-Tray 1650 Dual Cab + HB Sahara Black",
  },
  "BDL-TT-1650-W": {
    sellableSku: "BDL-TT-1650-W",
    name: "T-Tray 1650 Dual Cab + HB Splash White",
  },
  "BDL-TT-1850-SHB": {
    sellableSku: "BDL-TT-1850-SHB",
    name: "T-Tray 1850 Dual Cab + HB Sahara Black",
  },
  "BDL-TT-1850-W": {
    sellableSku: "BDL-TT-1850-W",
    name: "T-Tray 1850 Dual Cab + HB Splash White",
  },
  "BDL-TT-2450-SHB": {
    sellableSku: "BDL-TT-2450-SHB",
    name: "T-Tray 2450 Single Cab + HB Sahara Black",
  },
  "BDL-TT-2450-W": {
    sellableSku: "BDL-TT-2450-W",
    name: "T-Tray 2450 Single Cab + HB Splash White",
  },
};

async function main() {
  const all = await prisma.bundleDefinition.findMany({
    where: { code: { startsWith: "BDL-TT-" } },
    select: { id: true, code: true },
  });

  for (const row of all) {
    const live = LIVE[row.code];
    const updated = await prisma.bundleDefinition.update({
      where: { id: row.id },
      data: live
        ? { sellableSku: live.sellableSku, name: live.name, active: true }
        : { sellableSku: null, active: false },
    });
    console.log(
      `${updated.code}  active=${updated.active}  sellableSku=${updated.sellableSku ?? "—"}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
