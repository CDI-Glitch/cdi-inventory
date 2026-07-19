import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function BundlesPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") redirect("/dashboard");

  const bundles = await prisma.bundleDefinition.findMany({
    include: { items: true },
    orderBy: { code: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bundles</h1>
        <Link
          href="/bundles/new"
          className="rounded-md bg-[#839DC0] px-3 py-2 text-sm font-medium text-white hover:bg-[#6a88ad]"
        >
          + New bundle
        </Link>
      </div>

      {bundles.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          No bundles defined yet. Create your first bundle to group SKUs together.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Product family</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Components</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => (
                <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/bundles/${b.id}`} className="font-mono text-[#839DC0] hover:underline">
                      {b.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{b.name}</td>
                  <td className="px-4 py-3 text-gray-500">{b.productFamily.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-center">{b.items.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      b.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {b.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
