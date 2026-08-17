import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { COMPONENT_ROLES } from "@/lib/constants";
import { refreshBundleKitsCache } from "@/lib/bundle-atp";
import { syncBundleToShopify } from "@/lib/shopify-sync";
import { canAccessBundles, canWriteBundles, roleFromSession } from "@/lib/permissions";

const CreateBundleSchema = z.object({
  code: z.string().regex(/^[A-Z0-9\-]+$/, "Code must be uppercase letters, numbers, hyphens"),
  name: z.string().min(1),
  productFamily: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    qty: z.number().int().min(1),
    componentRole: z.enum(COMPONENT_ROLES),
    required: z.boolean().default(true),
    sortOrder: z.number().int(),
    notes: z.string().optional(),
    nonConstraining: z.boolean().optional(),
    altGroupKey: z.string().nullable().optional(),
  })).min(1, "Bundle must have at least one component"),
  sellableSku: z.string().optional().nullable(),
  shopifyInventoryItemId: z.string().optional().nullable(),
  shopifyVariantId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessBundles(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bundles = await prisma.bundleDefinition.findMany({
    include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(bundles);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !canWriteBundles(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateBundleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { code, name, productFamily, items, sellableSku, shopifyInventoryItemId, shopifyVariantId } = parsed.data;

  const existing = await prisma.bundleDefinition.findUnique({ where: { code } });
  if (existing) return NextResponse.json({ error: "Bundle code already exists" }, { status: 409 });

  // CONSUMABLE items (bulk hardware, manually deducted) never participate in bundles
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

  const bundle = await prisma.bundleDefinition.create({
    data: {
      code,
      name,
      productFamily,
      sellableSku: sellableSku?.trim() || null,
      shopifyInventoryItemId: shopifyInventoryItemId?.trim() || null,
      shopifyVariantId: shopifyVariantId?.trim() || null,
      items: { create: items.map((item) => ({
        ...item,
        nonConstraining: item.nonConstraining ?? false,
        altGroupKey: item.altGroupKey?.trim() || null,
      })) },
    },
    include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
  });

  if (bundle.sellableSku || bundle.shopifyInventoryItemId) {
    try {
      await refreshBundleKitsCache(bundle.id);
      await syncBundleToShopify(bundle.id);
    } catch (err) {
      console.error("[POST /api/bundles] kits cache/sync", err);
    }
  }

  return NextResponse.json(bundle, { status: 201 });
}
