import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const all = await prisma.product.findMany({ where: { active: true }, select: { category: true } });
  const total = all.length;
  const byCat: Record<string, number> = {};
  for (const p of all) {
    byCat[p.category] = (byCat[p.category] || 0) + 1;
  }
  process.stdout.write("Total active SKUs: " + total + "\n");
  Object.entries(byCat).sort().forEach(([cat, n]) => {
    process.stdout.write(`  ${cat}: ${n}\n`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
