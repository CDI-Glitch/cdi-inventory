import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewProductForm } from "@/components/inventory/new-product-form";
import { asRole, canCreateProduct } from "@/lib/permissions";

export default async function NewProductPage() {
  const session = await auth();
  const role = asRole((session?.user as any)?.role);
  if (!canCreateProduct(role)) redirect("/inventory");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add SKU</h1>
      <NewProductForm />
    </div>
  );
}
