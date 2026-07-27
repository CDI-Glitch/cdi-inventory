import { prisma } from "./db";
import { randomUUID } from "crypto";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

// In-memory token cache — valid for 24 h, refreshed 60 s before expiry
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiresAt - 60_000) {
    return _cachedToken;
  }

  if (!SHOPIFY_DOMAIN || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error("Shopify credentials not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET)");
  }

  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify token request failed (${res.status}): ${text}`);
  }

  const { access_token, expires_in } = await res.json();
  _cachedToken = access_token as string;
  _tokenExpiresAt = Date.now() + (expires_in as number) * 1000;
  return _cachedToken;
}

interface ShopifyGraphQLResponse<T = any> {
  data?: T;
  errors?: { message: string }[];
}

async function shopifyGraphQL<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const token = await getToken();

  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/2026-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
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
    // @idempotent directive is required since Shopify API 2026-04
    const idempotencyKey = randomUUID();

    // Set absolute available quantity directly — no read needed
    const result = await shopifyGraphQL<any>(
      `mutation SetInventory($input: InventorySetQuantitiesInput!) {
        inventorySetQuantities(input: $input) @idempotent(key: "${idempotencyKey}") {
          userErrors { field message }
        }
      }`,
      {
        input: {
          reason: "correction",
          name: "available",
          quantities: [
            {
              inventoryItemId: `gid://shopify/InventoryItem/${product.shopifyInventoryItemId}`,
              locationId: `gid://shopify/Location/${location.shopifyLocationId}`,
              quantity: available,
              changeFromQuantity: null, // null = skip CAS check, Portal is source of truth
            },
          ],
        },
      }
    );

    const userErrors = result?.inventorySetQuantities?.userErrors ?? [];
    if (userErrors.length > 0) {
      throw new Error(userErrors.map((e: any) => `${e.field}: ${e.message}`).join("; "));
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
