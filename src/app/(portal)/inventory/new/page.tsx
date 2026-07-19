import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewProductForm } from "@/components/inventory/new-product-form";

export default async function NewProductPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") redirect("/inventory");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add SKU</h1>
      <NewProductForm />
    </div>
  );
}
