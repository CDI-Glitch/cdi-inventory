import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const result = await prisma.product.updateMany({
    where: {
      category: "ACCESSORY",
      sku: { in: ["4122*1600", "4122*1600-SHB", "4122*1600-W", "4122*1800", "4122*1800-SHB", "4122*1800-W"] },
    },
    data: { category: "UNISTRUT" },
  });

  process.stdout.write(`Updated ${result.count} products to UNISTRUT\n`);
}

main()
  .catch((e) => { console.error("❌ Error:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
