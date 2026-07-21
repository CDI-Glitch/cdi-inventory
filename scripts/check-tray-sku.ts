import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const rows = await prisma.product.findMany({ where: { category: "TRAY" } });
  rows.forEach((r) => process.stdout.write(`${r.sku} | ${r.name} | ${r.category}\n`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
