import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

const RENAMES = [
  { from: "TT-QBX-55-L", to: "TT-QBX-56-L" },
  { from: "TT-QBX-55-L-SHB", to: "TT-QBX-56-L-SHB" },
  { from: "TT-QBX-55-L-W", to: "TT-QBX-56-L-W" },
];

async function main() {
  for (const { from, to } of RENAMES) {
    const clash = await prisma.product.findUnique({ where: { sku: to } });
    if (clash) {
      console.log(`SKIP (target exists): ${from} -> ${to}`);
      continue;
    }
    const existing = await prisma.product.findUnique({ where: { sku: from } });
    if (!existing) {
      console.log(`SKIP (source missing): ${from}`);
      continue;
    }
    await prisma.product.update({
      where: { sku: from },
      data: { sku: to },
    });
    console.log(`RENAMED: ${from} -> ${to}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
