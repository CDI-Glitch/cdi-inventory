import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const rows = await prisma.product.findMany({
    where: { category: "UNDERBODY_TOOLBOX" },
    select: { sku: true, name: true, unit: true },
    orderBy: { sku: "asc" },
  });
  process.stdout.write(`Total UNDERBODY_TOOLBOX: ${rows.length}\n`);
  const units = [...new Set(rows.map((r) => r.unit))];
  process.stdout.write(`Units in use: ${JSON.stringify(units)}\n`);
  const pairCandidates = rows.filter((r) => r.name.toLowerCase().includes("pair"));
  process.stdout.write(`Name contains 'Pair': ${pairCandidates.length}\n`);
  for (const r of pairCandidates) {
    process.stdout.write(`  ${r.sku} | unit=${r.unit}\n`);
  }
  if (pairCandidates.length === 0) process.stdout.write("  (none — all good)\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
