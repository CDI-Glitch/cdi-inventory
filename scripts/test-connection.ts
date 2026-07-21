import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const count = await prisma.product.count();
  console.log(`✅ Connected! Products in DB: ${count}`);

  const categories = await prisma.product.groupBy({
    by: ["category"],
    _count: true,
  });
  console.log("Categories in DB:");
  categories.forEach((c) => console.log(` - ${c.category}: ${c._count} products`));
}

main()
  .catch((e) => console.error("❌ Failed:", e.message))
  .finally(() => prisma.$disconnect());
