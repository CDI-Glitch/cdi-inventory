import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { BundleForm } from "@/components/bundles/bundle-form";
import { BundleBomView } from "@/components/bundles/bundle-bom-view";
import { ShopifyBindingPanel } from "@/components/inventory/shopify-binding-panel";
import Link from "next/link";
import { asRole, canAccessBundles, canWriteBundles } from "@/lib/permissions";

export default async function BundleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = asRole((session?.user as any)?.role);
  if (!canAccessBundles(role)) redirect("/dashboard");
  const canWrite = canWriteBundles(role);

  const { id } = await params;
  const [bundle, products] = await Promise.all([
    prisma.bundleDefinition.findUnique({
      where: { id },
      include: {
        items: { include: { product: true }, orderBy: { sortOrder: "asc" } },
        locationStocks: { include: { location: true } },
      },
    }),
    canWrite
      ? prisma.product.findMany({
          where: { active: true, category: { not: "CONSUMABLE" } },
          orderBy: { sku: "asc" },
        })
      : Promise.resolve([]),
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{canWrite ? "Edit bundle" : "View bundle"}</h1>
      {canWrite ? (
        <>
          {bundle.sellableSku && (
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <ShopifyBindingPanel
                sku={bundle.sellableSku}
                shopifyInventoryItemId={bundle.shopifyInventoryItemId}
                shopifyVariantId={bundle.shopifyVariantId}
                saveUrl={`/api/bundles/${bundle.id}`}
                readOnly={false}
              />
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Cached kits</h3>
                {bundle.locationStocks.length === 0 ? (
                  <p className="text-sm text-gray-400">No cache yet. Save the bundle or run Shopify sync.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {bundle.locationStocks.map((row) => (
                      <li key={row.id} className="flex justify-between">
                        <span className="text-gray-600">{row.location.name}</span>
                        <span className="font-mono font-medium">{row.cachedKits}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <BundleForm products={products} bundle={bundle} />
        </>
      ) : (
        <BundleBomView bundle={bundle} />
      )}
    </div>
  );
}
