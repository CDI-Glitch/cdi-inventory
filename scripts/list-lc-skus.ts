import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const rows = await prisma.product.findMany({
    where: { sku: { startsWith: "LC" } },
    orderBy: { sku: "asc" },
    select: { sku: true, name: true },
  });
  rows.forEach((r) => process.stdout.write(`${r.sku} | ${r.name}\n`));
  process.stdout.write(`\nTotal: ${rows.length}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
