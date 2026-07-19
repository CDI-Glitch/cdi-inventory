import { prisma } from "./db";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

interface ShopifyGraphQLResponse<T = any> {
  data?: T;
  errors?: { message: string }[];
}

async function shopifyGraphQL<T>(query: string, variables?: Record<string, any>): Promise<T> {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
    throw new Error("Shopify credentials not configured");
  }

  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/2024-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const json: ShopifyGraphQLResponse<T> = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data as T;
}

/**
 * Push the Available quantity (onHand − reserved) for a product+location
 * to Shopify Inventory API. Creates a SyncLog entry for audit.
 */
export async function syncProductToShopify(
  productId: string,
  locationId: string
): Promise<void> {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });

  if (!product.shopifyInventoryItemId || !location.shopifyLocationId) {
    // Not linked to Shopify; skip silently
    return;
  }

  // Compute available
  const [onHandResult, reservedResult] = await Promise.all([
    prisma.inventoryLog.aggregate({
      where: { productId, locationId },
      _sum: { delta: true },
    }),
    prisma.generatedMovement.aggregate({
      where: { productId, locationId, reservedQty: { gt: 0 } },
      _sum: { reservedQty: true },
    }),
  ]);

  const onHand = onHandResult._sum.delta ?? 0;
  const reserved = reservedResult._sum.reservedQty ?? 0;
  const available = Math.max(0, onHand - reserved);

  try {
    // Get current Shopify qty to compute delta
    const data = await shopifyGraphQL<any>(
      `query GetInventoryLevel($inventoryItemId: ID!, $locationId: ID!) {
        inventoryLevel(inventoryItemId: $inventoryItemId, locationId: $locationId) {
          quantities(names: ["available"]) {
            name
            quantity
          }
        }
      }`,
      {
        inventoryItemId: `gid://shopify/InventoryItem/${product.shopifyInventoryItemId}`,
        locationId: `gid://shopify/Location/${location.shopifyLocationId}`,
      }
    );

    const currentQty: number =
      data?.inventoryLevel?.quantities?.[0]?.quantity ?? 0;
    const delta = available - currentQty;

    if (delta !== 0) {
      await shopifyGraphQL(
        `mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
          inventoryAdjustQuantities(input: $input) {
            userErrors { field message }
          }
        }`,
        {
          input: {
            reason: "correction",
            name: "available",
            changes: [
              {
                inventoryItemId: `gid://shopify/InventoryItem/${product.shopifyInventoryItemId}`,
                locationId: `gid://shopify/Location/${location.shopifyLocationId}`,
                delta,
              },
            ],
          },
        }
      );
    }

    await prisma.syncLog.create({
      data: {
        productId,
        locationId,
        sentQty: available,
        status: "success",
      },
    });
  } catch (err: any) {
    await prisma.syncLog.create({
      data: {
        productId,
        locationId,
        sentQty: available,
        status: "error",
        error: err.message,
      },
    });
    throw err;
  }
}

/**
 * Sync all active products that have Shopify IDs configured.
 * Called from admin UI or scheduled job.
 */
export async function syncAllToShopify(): Promise<{
  synced: number;
  errors: number;
}> {
  const products = await prisma.product.findMany({
    where: { active: true, shopifyInventoryItemId: { not: null } },
  });

  const locations = await prisma.location.findMany({
    where: { active: true, shopifyLocationId: { not: null } },
  });

  let synced = 0;
  let errors = 0;

  for (const product of products) {
    for (const location of locations) {
      try {
        await syncProductToShopify(product.id, location.id);
        synced++;
      } catch {
        errors++;
      }
    }
  }

  return { synced, errors };
}
