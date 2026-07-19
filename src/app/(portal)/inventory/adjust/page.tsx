import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdjustForm } from "@/components/inventory/adjust-form";

export default async function AdjustPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") redirect("/inventory");

  const [products, locations] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { sku: "asc" } }),
    prisma.location.findMany({ where: { active: true } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Adjust Stock</h1>
      <AdjustForm products={products} locations={locations} />
    </div>
  );
}
