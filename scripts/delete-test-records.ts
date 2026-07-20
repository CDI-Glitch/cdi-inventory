import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const records = await prisma.salesRecord.findMany({
    where: { recordId: { in: ["SR-0001", "SR-0002"] } },
    select: { id: true, recordId: true },
  });

  if (records.length === 0) {
    console.log("No matching records found.");
    return;
  }

  console.log("Found:", records.map((r) => r.recordId).join(", "));

  // Delete child movements first (cascade safety)
  for (const r of records) {
    await prisma.generatedMovement.deleteMany({ where: { salesRecordId: r.id } });
  }

  const deleted = await prisma.salesRecord.deleteMany({
    where: { recordId: { in: ["SR-0001", "SR-0002"] } },
  });

  console.log(`Deleted ${deleted.count} sales record(s).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
