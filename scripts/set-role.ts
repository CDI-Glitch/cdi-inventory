import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const email = process.argv[2];
const role = process.argv[3];

if (!email || !role) {
  console.error("Usage: tsx scripts/set-role.ts <email> <role>");
  process.exit(1);
}

prisma.user.update({ where: { email }, data: { role } })
  .then(u => console.log(`Updated: ${u.email} → ${u.role}`))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
