import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { BundleForm } from "@/components/bundles/bundle-form";
import Link from "next/link";

export default async function BundleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const [bundle, products] = await Promise.all([
    prisma.bundleDefinition.findUnique({
      where: { id },
      include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.product.findMany({ where: { active: true }, orderBy: { sku: "asc" } }),
  ]);

  if (!bundle) notFound();

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/bundles" className="text-sm text-gray-500 hover:text-gray-700">
          ← Bundles
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono font-semibold text-gray-900">{bundle.code}</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit bundle</h1>
      <BundleForm products={products} bundle={bundle} />
    </div>
  );
}
