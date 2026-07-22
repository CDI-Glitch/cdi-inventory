import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { NewSalesForm } from "@/components/sales/new-sales-form";

export default async function NewSalesPage() {
  const session = await auth();
  if ((session?.user as any)?.role === "viewer") redirect("/sales");

  const [products, rawBundles, locations] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { sku: "asc" }, select: { sku: true, name: true, category: true } }),
    prisma.bundleDefinition.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.location.findMany({ where: { active: true } }),
  ]);

  const bundles = rawBundles.map((b) => ({
    code: b.code,
    name: b.name,
    items: b.items.map((i) => ({
      sku: i.product.sku,
      name: i.product.name,
      qty: i.qty,
    })),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New sales record</h1>
      <NewSalesForm products={products} bundles={bundles} locations={locations} />
    </div>
  );
}
