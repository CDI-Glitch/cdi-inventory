import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SKUS = [
  { sku: "TT-BN-BX/MG", name: "Bolt & Nut Kit — Under Tray Toolbox & Mud Guards",     reorderPoint: 10 },
  { sku: "TT-BN-HBL",   name: "Bolt & Nut Kit — Headboard L Bracket",                  reorderPoint: 10 },
  { sku: "TT-BN-HB",    name: "Bolt & Nut Kit — Headboard to Tray C 100x50 Channel",   reorderPoint: 10 },
  { sku: "TT-BN-FK",    name: "Bolt & Nut Kit — Fitting Kit to Ute Chassis",            reorderPoint: 10 },
  { sku: "TT-BN-FKT",   name: "Bolt & Nut Kit — Fitting Kit to Tray C 100x50 Channel", reorderPoint: 10 },
  { sku: "TT-BN-DNP",   name: "Bolt & Nut Kit — MF",                                   reorderPoint: 10 },
  { sku: "TT-BN-BSG",   name: "Bolt & Nut Kit — BSG",                                   reorderPoint: 10 },
];

async function main() {
  let created = 0, skipped = 0;

  for (const item of SKUS) {
    const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (existing) {
      process.stdout.write(`SKIP (exists): ${item.sku}\n`);
      skipped++;
      continue;
    }

    await prisma.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        category: "FITTING_KIT",
        unit: "Set",
        reorderPoint: item.reorderPoint,
        active: true,
      },
    });

    process.stdout.write(`✅ ${item.sku} | ${item.name} | Set | qty: 0 | reorder: ${item.reorderPoint}\n`);
    created++;
  }

  process.stdout.write(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
