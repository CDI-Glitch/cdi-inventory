/**
 * One-off: move CSM0013 (挡泥皮) out of the CONSUMABLE isolation category
 * into FITTING_KIT, so it can be added as a normal Bundle component
 * (category === "CONSUMABLE" is hard-blocked from Bundle/Sales-line APIs,
 * see docs/constitution.md decision 15 / §D3).
 *
 * Run: npx tsx scripts/recategorize-csm0013-fitting-kit.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const product = await prisma.product.findUnique({ where: { sku: "CSM0013" } });
  if (!product) throw new Error("Missing product SKU: CSM0013");

  console.log(`Before: ${product.sku} | ${product.name} | category=${product.category}`);

  if (product.category === "FITTING_KIT") {
    console.log("Already FITTING_KIT, no change needed.");
    return;
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { category: "FITTING_KIT" },
  });

  console.log(`After:  ${updated.sku} | ${updated.name} | category=${updated.category}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
