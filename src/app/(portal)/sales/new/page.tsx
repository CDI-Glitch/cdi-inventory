import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { NewSalesForm } from "@/components/sales/new-sales-form";

export default async function NewSalesPage() {
  const session = await auth();
  if ((session?.user as any)?.role === "viewer") redirect("/sales");

  const [products, bundles, locations] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { sku: "asc" } }),
    prisma.bundleDefinition.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.location.findMany({ where: { active: true } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New sales record</h1>
      <NewSalesForm products={products} bundles={bundles} locations={locations} />
    </div>
  );
}
