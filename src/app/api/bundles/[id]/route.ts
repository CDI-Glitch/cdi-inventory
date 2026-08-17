import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { COMPONENT_ROLES } from "@/lib/constants";
import { refreshBundleKitsCache } from "@/lib/bundle-atp";
import { syncBundleToShopify } from "@/lib/shopify-sync";
import { canAccessBundles, canWriteBundles, roleFromSession } from "@/lib/permissions";

const UpdateBundleSchema = z.object({
  name: z.string().min(1).optional(),
  productFamily: z.string().min(1).optional(),
  active: z.boolean().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    productId: z.string().min(1),
    qty: z.number().int().min(1),
    componentRole: z.enum(COMPONENT_ROLES),
    required: z.boolean().default(true),
    sortOrder: z.number().int(),
    notes: z.string().optional(),
    nonConstraining: z.boolean().optional(),
    altGroupKey: z.string().nullable().optional(),
  })).optional(),
  sellableSku: z.string().optional().nullable(),
  shopifyInventoryItemId: z.string().optional().nullable(),
  shopifyVariantId: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessBundles(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const bundle = await prisma.bundleDefinition.findUnique({
    where: { id },
    include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
  });

  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bundle);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !canWriteBundles(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateBundleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, sellableSku, shopifyInventoryItemId, shopifyVariantId, ...rest } = parsed.data;

  const header: Prisma.BundleDefinitionUpdateInput = { ...rest };
  if (sellableSku !== undefined) header.sellableSku = sellableSku?.trim() || null;
  if (shopifyInventoryItemId !== undefined) header.shopifyInventoryItemId = shopifyInventoryItemId?.trim() || null;
  if (shopifyVariantId !== undefined) header.shopifyVariantId = shopifyVariantId?.trim() || null;

  // CONSUMABLE items (bulk hardware, manually deducted) never participate in bundles
  if (items !== undefined && items.length > 0) {
    const consumableProducts = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, category: "CONSUMABLE" },
      select: { sku: true },
    });
    if (consumableProducts.length > 0) {
      return NextResponse.json(
        { error: `Consumable SKUs cannot be added to bundles: ${consumableProducts.map((p) => p.sku).join(", ")}` },
        { status: 400 }
      );
    }
  }

  // If items provided, replace all items
  if (items !== undefined) {
    await prisma.bundleItem.deleteMany({ where: { bundleId: id } });
    await prisma.bundleItem.createMany({
      data: items.map(({ id: _itemId, ...item }) => ({
        productId: item.productId,
        qty: item.qty,
        componentRole: item.componentRole,
        required: item.required,
        sortOrder: item.sortOrder,
        notes: item.notes,
        nonConstraining: item.nonConstraining ?? false,
        altGroupKey: item.altGroupKey?.trim() || null,
        bundleId: id,
      })),
    });
  }

  const bundle = await prisma.bundleDefinition.update({
    where: { id },
    data: header,
    include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
  });

  try {
    await refreshBundleKitsCache(bundle.id);
    await syncBundleToShopify(bundle.id);
  } catch (err) {
    console.error("[PUT /api/bundles] kits cache/sync", err);
  }

  return NextResponse.json(bundle);
}
