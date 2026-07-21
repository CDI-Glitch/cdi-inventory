import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const products = await prisma.product.findMany({
    where: { sku: { startsWith: "LC" } },
  });

  let updated = 0;
  for (const p of products) {
    const newName = p.name.replace(
      "LC79 Factory Tray Canopy",
      "LC79 Jack Off Factory Tray Canopy"
    );
    if (newName !== p.name) {
      await prisma.product.update({
        where: { sku: p.sku },
        data: { name: newName },
      });
      process.stdout.write(`✅ ${p.sku}: ${p.name}\n    → ${newName}\n`);
      updated++;
    }
  }

  process.stdout.write(`\nDone. Updated ${updated} products.\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
