import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { BundleForm } from "@/components/bundles/bundle-form";

export default async function NewBundlePage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") redirect("/dashboard");

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sku: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New bundle</h1>
      <BundleForm products={products} />
    </div>
  );
}
