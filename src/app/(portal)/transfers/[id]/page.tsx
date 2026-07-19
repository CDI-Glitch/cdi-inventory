import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TransferStatusActions } from "@/components/transfers/transfer-status-actions";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_transit: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === "viewer") redirect("/dashboard");

  const { id } = await params;
  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: { fromLocation: true, toLocation: true, product: true },
  });

  if (!transfer) notFound();

  const isTerminal = ["completed", "cancelled"].includes(transfer.status);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/transfers" className="text-sm text-gray-500 hover:text-gray-700">
          ← Transfers
        </Link>
      </div>

      <div className="grid gap-6 max-w-xl">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Transfer</h1>
            <span className={cn(
              "rounded-full px-3 py-1 text-sm font-medium",
              STATUS_STYLES[transfer.status] ?? "bg-gray-100 text-gray-500"
            )}>
              {STATUS_LABELS[transfer.status] ?? transfer.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">SKU</span>
              <p className="font-mono font-medium text-blue-600 mt-0.5">{transfer.product.sku}</p>
            </div>
            <div>
              <span className="text-gray-500">Product</span>
              <p className="font-medium text-gray-900 mt-0.5">{transfer.product.name}</p>
            </div>
            <div>
              <span className="text-gray-500">From</span>
              <p className="font-medium text-gray-900 mt-0.5">{transfer.fromLocation.name}</p>
            </div>
            <div>
              <span className="text-gray-500">To</span>
              <p className="font-medium text-gray-900 mt-0.5">{transfer.toLocation.name}</p>
            </div>
            <div>
              <span className="text-gray-500">Quantity</span>
              <p className="font-bold text-gray-900 mt-0.5">{transfer.qty}</p>
            </div>
            <div>
              <span className="text-gray-500">Created</span>
              <p className="font-medium text-gray-900 mt-0.5">
                {new Date(transfer.createdAt).toLocaleDateString("en-AU")}
              </p>
            </div>
            {transfer.completedAt && (
              <div>
                <span className="text-gray-500">Completed</span>
                <p className="font-medium text-gray-900 mt-0.5">
                  {new Date(transfer.completedAt).toLocaleDateString("en-AU")}
                </p>
              </div>
            )}
            {transfer.notes && (
              <div className="col-span-2">
                <span className="text-gray-500">Notes</span>
                <p className="font-medium text-gray-900 mt-0.5">{transfer.notes}</p>
              </div>
            )}
          </div>
        </div>

        {!isTerminal && (
          <TransferStatusActions id={transfer.id} currentStatus={transfer.status} />
        )}
      </div>
    </div>
  );
}
