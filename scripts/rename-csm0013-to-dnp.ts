/**
 * One-off: rename CSM0013 (挡泥皮) to DNP.
 * DNP already exists as an embedded code fragment in TT-BN-DNP (its bolt &
 * nut kit); giving the panel itself a plain "DNP" code (no TT- prefix,
 * matching FK/CXH) avoids implying it's Tray-exclusive — it's also used on
 * Service Body. Pure Product.sku rename; all relations key off productId,
 * so BundleItem / InventoryLog / GeneratedMovement are unaffected. Past
 * SalesLine.snapshotItems keep whatever sku string was frozen at the time
 * (still says CSM0013 for old lines) — accurate historical record, not
 * touched here.
 *
 * Run: npx tsx scripts/rename-csm0013-to-dnp.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const existingDnp = await prisma.product.findUnique({ where: { sku: "DNP" } });
  if (existingDnp) throw new Error("SKU DNP already exists — aborting to avoid collision.");

  const product = await prisma.product.findUnique({ where: { sku: "CSM0013" } });
  if (!product) throw new Error("Missing product SKU: CSM0013");

  console.log(`Before: ${product.sku} | ${product.name} | category=${product.category}`);

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { sku: "DNP" },
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
