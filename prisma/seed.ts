import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@cdi.com.au";
  const password = process.env.ADMIN_PASSWORD || "changeme";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hash(password, 12),
        name: "CDI Admin",
        role: "admin",
      },
    });
    console.log(`Admin user created: ${email}`);
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  const locations = ["Brisbane", "Sydney"];
  for (const name of locations) {
    await prisma.location.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("Locations seeded: Brisbane, Sydney");

  const staffAccounts = [
    { email: "brisbane@cdi.com", name: "Brisbane", password: "Cdi@Bne2026$", role: "editor" },
    { email: "sydney@cdi.com",   name: "Sydney",   password: "Cdi@Syd2026$", role: "editor" },
  ];

  for (const acc of staffAccounts) {
    const exists = await prisma.user.findUnique({ where: { email: acc.email } });
    if (!exists) {
      await prisma.user.create({
        data: {
          email: acc.email,
          name: acc.name,
          passwordHash: await hash(acc.password, 12),
          role: acc.role,
        },
      });
      console.log(`Created: ${acc.email}`);
    } else {
      console.log(`Already exists: ${acc.email}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
