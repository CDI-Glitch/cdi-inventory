import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TransferForm } from "@/components/transfers/transfer-form";
import { asRole, canWriteTransfers } from "@/lib/permissions";

export default async function NewTransferPage() {
  const session = await auth();
  const role = asRole((session?.user as any)?.role);
  if (!canWriteTransfers(role)) redirect("/dashboard");

  const [products, locations] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { sku: "asc" } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New stock transfer</h1>
      <TransferForm products={products} locations={locations} />
    </div>
  );
}
