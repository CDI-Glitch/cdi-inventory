/**
 * Set sellableSku on RAW 1650/1850, bind Shopify IDs, refresh kits, push.
 * Run: npx tsx scripts/bind-t-tray-raw-1650-1850.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { refreshBundleKitsCache } from "../src/lib/bundle-atp";
import { syncBundleToShopify } from "../src/lib/shopify-sync";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as any);

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

const TARGETS = [
  { code: "BDL-TT-1650-RAW", sellableSku: "BDL-TT-1650-RAW" },
  { code: "BDL-TT-1850-RAW", sellableSku: "BDL-TT-1850-RAW" },
];

function gidNumeric(gid: string): string {
  const n = gid.split("/").pop();
  if (!n) throw new Error(`Unexpected GID: ${gid}`);
  return n;
}

async function getToken(): Promise<string> {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error(
      "Need SHOPIFY_STORE_DOMAIN + SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET in .env"
    );
  }
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    throw new Error(`Shopify token failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

async function lookupVariant(token: string, sku: string) {
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2026-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      query: `query VariantBySku($q: String!) {
        productVariants(first: 5, query: $q) {
          nodes { id sku inventoryItem { id } }
        }
      }`,
      variables: { q: `sku:${sku}` },
    }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }
  const nodes = json.data?.productVariants?.nodes ?? [];
  const exact = nodes.filter((n: { sku: string }) => n.sku === sku);
  if (exact.length !== 1) {
    throw new Error(
      `SKU ${sku}: expected 1 variant, got ${exact.length} (${nodes.map((n: { sku: string }) => n.sku).join(", ") || "none"})`
    );
  }
  return {
    variantId: gidNumeric(exact[0].id),
    inventoryItemId: gidNumeric(exact[0].inventoryItem.id),
  };
}

async function main() {
  let token: string | null = null;
  try {
    token = await getToken();
  } catch (err) {
    console.log(`Shopify lookup skipped: ${(err as Error).message}`);
  }

  for (const target of TARGETS) {
    const bundle = await prisma.bundleDefinition.findUnique({ where: { code: target.code } });
    if (!bundle) throw new Error(`Missing bundle ${target.code}`);

    const data: {
      active: boolean;
      sellableSku: string;
      shopifyVariantId?: string;
      shopifyInventoryItemId?: string;
    } = {
      active: true,
      sellableSku: target.sellableSku,
    };

    if (token) {
      const ids = await lookupVariant(token, target.sellableSku);
      data.shopifyVariantId = ids.variantId;
      data.shopifyInventoryItemId = ids.inventoryItemId;
    }

    await prisma.bundleDefinition.update({
      where: { id: bundle.id },
      data,
    });
    await refreshBundleKitsCache(bundle.id);
    if (token && data.shopifyInventoryItemId) {
      await syncBundleToShopify(bundle.id);
      console.log(
        `${target.code}  sku=${target.sellableSku}  variant=${data.shopifyVariantId}  inventoryItem=${data.shopifyInventoryItemId}`
      );
    } else {
      console.log(`${target.code}  sku=${target.sellableSku}  kits refreshed (Shopify IDs not bound)`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
