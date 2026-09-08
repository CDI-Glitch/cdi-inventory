import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { calcBundleKits } from "../src/lib/bundle-atp";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const CODES = [
  "BDL-TT-1650-RAW", "BDL-TT-1650-SHB", "BDL-TT-1650-W",
  "BDL-TT-1850-RAW", "BDL-TT-1850-SHB", "BDL-TT-1850-W",
  "BDL-TT-2150-RAW", "BDL-TT-2150-SHB", "BDL-TT-2150-W",
  "BDL-TT-2450-RAW", "BDL-TT-2450-SHB", "BDL-TT-2450-W",
];

async function main() {
  const locations = await prisma.location.findMany({ where: { active: true } });
  const bundles = await prisma.bundleDefinition.findMany({ where: { code: { in: CODES } } });
  const byCode = new Map(bundles.map((b) => [b.code, b]));

  for (const code of CODES) {
    const bundle = byCode.get(code);
    if (!bundle) {
      console.log(`${code}\tMISSING`);
      continue;
    }
    const parts: string[] = [];
    for (const loc of locations) {
      const { kits } = await calcBundleKits(bundle.id, loc.id);
      parts.push(`${loc.name}=${kits}`);
    }
    console.log(`${code}\t${parts.join("\t")}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
