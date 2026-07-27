// Fetch all Shopify products with their InventoryItem IDs
// Uses client credentials grant (same as the Portal's sync logic)
//
// Usage:
//   $env:SHOPIFY_CLIENT_ID="8c3db662f811dbb18eba8d7de7d8ae8c"
//   $env:SHOPIFY_CLIENT_SECRET="your_secret_here"
//   node scripts/fetch-shopify-inventory-items.cjs

const SHOP   = 'vdg1pn-e4.myshopify.com';
const CID    = process.env.SHOPIFY_CLIENT_ID;
const SECRET = process.env.SHOPIFY_CLIENT_SECRET;

if (!CID || !SECRET) {
  console.error('ERROR: set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET env vars first');
  process.exit(1);
}

async function getToken() {
  const res = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CID,
      client_secret: SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Token failed: ${res.status} ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

async function gql(token, query, variables = {}) {
  const res = await fetch(`https://${SHOP}/admin/api/2026-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
  return data;
}

async function main() {
  const token = await getToken();
  console.log('Token obtained OK\n');

  let cursor = null;
  let allVariants = [];

  // Paginate through all products
  do {
    const data = await gql(token, `
      query($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              variants(first: 10) {
                edges {
                  node {
                    id
                    sku
                    inventoryItem {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    `, { cursor });

    const products = data.products.edges;
    for (const { node: product } of products) {
      for (const { node: variant } of product.variants.edges) {
        // Strip gid:// prefixes to get raw numeric IDs
        const variantId      = variant.id.replace('gid://shopify/ProductVariant/', '');
        const inventoryItemId = variant.inventoryItem?.id?.replace('gid://shopify/InventoryItem/', '') ?? '';
        allVariants.push({
          product: product.title,
          sku: variant.sku || '(no sku)',
          variantId,
          inventoryItemId,
        });
      }
    }

    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);

  // Print as table
  console.log(`${'Product'.padEnd(50)} ${'SKU'.padEnd(30)} ${'VariantID'.padEnd(16)} InventoryItemID`);
  console.log('-'.repeat(120));
  for (const v of allVariants) {
    console.log(`${v.product.substring(0, 49).padEnd(50)} ${v.sku.substring(0, 29).padEnd(30)} ${v.variantId.padEnd(16)} ${v.inventoryItemId}`);
  }

  console.log(`\nTotal variants: ${allVariants.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
