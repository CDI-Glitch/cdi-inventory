import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as any);

  // Fix 1: Remove " C Channel" from all LC79 Factory Tray Canopy names
  // Fix 2: Normalize all category values to UPPERCASE
  const products = await prisma.product.findMany({
    select: { id: true, sku: true, name: true, category: true },
  });

  console.log(`Found ${products.length} products`);
  let fixed = 0;

  for (const p of products) {
    const newName = p.name.replace(' C Channel', '');
    const newCategory = p.category.toUpperCase();
    const nameChanged = newName !== p.name;
    const categoryChanged = newCategory !== p.category;

    if (nameChanged || categoryChanged) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          ...(nameChanged ? { name: newName } : {}),
          ...(categoryChanged ? { category: newCategory } : {}),
        },
      });
      if (nameChanged) console.log(`NAME:     ${p.name}`);
      if (nameChanged) console.log(`       -> ${newName}`);
      if (categoryChanged) console.log(`CATEGORY: ${p.sku} ${p.category} -> ${newCategory}`);
      fixed++;
    }
  }

  await (prisma as any).$disconnect();
  console.log(`\nDone. Fixed: ${fixed} products`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
