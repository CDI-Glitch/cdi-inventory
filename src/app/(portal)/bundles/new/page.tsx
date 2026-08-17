import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { BundleForm } from "@/components/bundles/bundle-form";
import { asRole, canWriteBundles } from "@/lib/permissions";

export default async function NewBundlePage() {
  const session = await auth();
  if (!canWriteBundles(asRole((session?.user as any)?.role))) redirect("/dashboard");

  const products = await prisma.product.findMany({
    // CONSUMABLE items (bulk hardware, manually deducted) never participate in bundles
    where: { active: true, category: { not: "CONSUMABLE" } },
    orderBy: { sku: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New bundle</h1>
      <BundleForm products={products} />
    </div>
  );
}
