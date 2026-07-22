import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { IncomingForm } from "@/components/incoming/incoming-form";

export default async function NewIncomingPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === "viewer") redirect("/dashboard");

  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, sku: true, name: true, category: true },
      orderBy: { sku: "asc" },
    }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New incoming shipment</h1>
      <IncomingForm products={products} locations={locations} />
    </div>
  );
}
