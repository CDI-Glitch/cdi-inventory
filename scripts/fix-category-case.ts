import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as any);

  const products = await prisma.product.findMany({ select: { id: true, sku: true, category: true } });
  console.log(`Found ${products.length} products`);

  let fixed = 0;
  for (const p of products) {
    const upper = p.category.toUpperCase();
    if (upper !== p.category) {
      await prisma.product.update({ where: { id: p.id }, data: { category: upper } });
      console.log(`FIXED: ${p.sku} → ${upper}`);
      fixed++;
    }
  }

  await (prisma as any).$disconnect();
  console.log(`\nDone. Fixed: ${fixed} products`);
}

main().catch(e => { console.error(e); process.exit(1); });
