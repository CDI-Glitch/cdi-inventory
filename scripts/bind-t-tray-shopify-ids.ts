/**
 * Look up live T-Tray variants on Shopify by sellableSku and write
 * shopifyInventoryItemId / shopifyVariantId onto BundleDefinition.
 *
 * Run: npx tsx scripts/bind-t-tray-shopify-ids.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { syncBundleToShopify } from "../src/lib/shopify-sync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

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
  const token = await getToken();
  const bundles = await prisma.bundleDefinition.findMany({
    where: { active: true, sellableSku: { not: null } },
    orderBy: { code: "asc" },
  });

  if (bundles.length === 0) {
    console.log("No active sellable bundles.");
    return;
  }

  for (const bundle of bundles) {
    const sku = bundle.sellableSku!;
    const ids = await lookupVariant(token, sku);
    await prisma.bundleDefinition.update({
      where: { id: bundle.id },
      data: {
        shopifyVariantId: ids.variantId,
        shopifyInventoryItemId: ids.inventoryItemId,
      },
    });
    await syncBundleToShopify(bundle.id);
    console.log(
      `${bundle.code}  sku=${sku}  variant=${ids.variantId}  inventoryItem=${ids.inventoryItemId}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
