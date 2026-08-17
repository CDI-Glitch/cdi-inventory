import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PacklistDocument } from "@/components/sales/packlist-document";
import { buildFulfillmentView } from "@/lib/sales-fulfillment-view";

export default async function PacklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) notFound();

  const { id } = await params;
  const record = await prisma.salesRecord.findUnique({
    where: { id },
    include: {
      location: true,
      lines: { orderBy: { sortOrder: "asc" } },
      movements: {
        include: { product: true, location: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!record) notFound();
  if (record.status === "quote" || record.status === "cancelled") notFound();

  const lineBundles = record.lines.filter((l) => l.lineType === "bundle").map((l) => l.itemCode);
  const bundleDefs =
    lineBundles.length > 0
      ? await prisma.bundleDefinition.findMany({
          where: { code: { in: lineBundles } },
          select: {
            code: true,
            name: true,
            items: {
              select: { qty: true, product: { select: { sku: true, name: true } } },
              orderBy: { sortOrder: "asc" },
            },
          },
        })
      : [];

  const liveBundles = Object.fromEntries(
    bundleDefs.map((b) => [
      b.code,
      {
        name: b.name,
        items: b.items.map((i) => ({ sku: i.product.sku, name: i.product.name, qty: i.qty })),
      },
    ])
  );

  const deductions =
    record.status === "completed"
      ? await prisma.inventoryLog.findMany({
          where: { reference: record.recordId, type: "sales_deduction" },
          include: { product: true, location: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

  const view = buildFulfillmentView({
    status: record.status,
    lines: record.lines,
    movements: record.movements,
    liveBundles,
    deductions,
  });

  const unresolved = view.altGroupTasks.filter((t) => !t.resolved);
  const printedAt = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const dateStr = record.date.toLocaleDateString("en-AU", { timeZone: "UTC" });

  return (
    <PacklistDocument
      record={{
        id: record.id,
        recordId: record.recordId,
        customer: record.customer,
        dateStr,
        location: record.location.name,
        invoiceOrQuote: record.invoiceNo || record.quoteNo || null,
        staffNotes: record.staffNotes,
      }}
      printedAt={printedAt}
      unresolved={unresolved}
      rows={view.packlistRows}
    />
  );
}
