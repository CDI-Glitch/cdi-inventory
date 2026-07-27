// Bulk-bind Shopify InventoryItem IDs and Variant IDs to Portal Product records
// Only Canopy, LC79 Canopy, Jerry Can, Spare Wheel are synced.
// Excludes: Tray, PKG, Trundle Drawer, Add-on accessories, Dev product.

const { Pool } = require('pg');

const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net',
  port: 43176,
  user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

// sku → { inventoryItemId, variantId }
const BINDINGS = {
  // ── Base Canopy 1000mm ──
  'CD-2D-17108':       { inventoryItemId: '56521659646251', variantId: '54431187599659' },
  'CD-2D-17108-SHB':   { inventoryItemId: '56521659580715', variantId: '54431187534123' },
  'CD-2D-17108-W':     { inventoryItemId: '56521659613483', variantId: '54431187566891' },

  // ── Base Canopy 1200mm ──
  'CD-2D-17128':       { inventoryItemId: '55840277299499', variantId: '53753696551211' },
  'CD-2D-17128-SHB':   { inventoryItemId: '55840277233963', variantId: '53753696485675' },
  'CD-2D-17128-W':     { inventoryItemId: '55840277266731', variantId: '53753696518443' },

  // ── Base Canopy 1400mm ──
  'CD-2D-17148':       { inventoryItemId: '55840405061931', variantId: '53753823559979' },
  'CD-2D-17148-SHB':   { inventoryItemId: '55840404996395', variantId: '53753823494443' },
  'CD-2D-17148-W':     { inventoryItemId: '55840405029163', variantId: '53753823527211' },

  // ── Base Canopy 1600mm ──
  'CD-2D-17168':       { inventoryItemId: '55840470696235', variantId: '53753889161515' },
  'CD-2D-17168-SHB':   { inventoryItemId: '55840470630699', variantId: '53753889095979' },
  'CD-2D-17168-W':     { inventoryItemId: '55840470663467', variantId: '53753889128747' },

  // ── Base Canopy 1800mm ──
  'CD-2D-17188':       { inventoryItemId: '55840525812011', variantId: '53753943982379' },
  'CD-2D-17188-SHB':   { inventoryItemId: '55840525746475', variantId: '53753943916843' },
  'CD-2D-17188-W':     { inventoryItemId: '55840525779243', variantId: '53753943949611' },

  // ── Base Canopy 1800mm Full Access ──
  'CD-3D-17188':       { inventoryItemId: '55840582271275', variantId: '53754000408875' },
  'CD-3D-17188-SHB':   { inventoryItemId: '55840582205739', variantId: '53754000343339' },
  'CD-3D-17188-W':     { inventoryItemId: '55840582238507', variantId: '53754000376107' },

  // ── LC79 Factory Tray Canopy 1200mm ──
  'LC-2D-181210-SHB':  { inventoryItemId: '56497436295467', variantId: '54406964445483' },
  'LC-2D-181210-ST':   { inventoryItemId: '56497436328235', variantId: '54406964478251' },
  'LC-2D-181210-G':    { inventoryItemId: '56497436361003', variantId: '54406964511019' },

  // ── LC79 Factory Tray Canopy 1600mm ──
  'LC-2D-181610-SHB':  { inventoryItemId: '55840803160363', variantId: '53754219397419' },
  'LC-2D-181610-ST':   { inventoryItemId: '55840808960299', variantId: '53754225197355' },
  'LC-2D-181610-G':    { inventoryItemId: '55840808993067', variantId: '53754225230123' },

  // ── LC79 Factory Tray Canopy 1800mm ──
  'LC-2D-181810-SHB':  { inventoryItemId: '55840814793003', variantId: '53754230997291' },
  'LC-2D-181810-ST':   { inventoryItemId: '55840814825771', variantId: '53754231030059' },
  'LC-2D-181810-G':    { inventoryItemId: '55840814858539', variantId: '53754231062827' },

  // ── Lockable Jerry Can Holder ──
  'CD-JCA':            { inventoryItemId: '55943751205163', variantId: '53856465781035' },
  'CD-JCA-SHB':        { inventoryItemId: '55943751139627', variantId: '53856465715499' },
  'CD-JCA-W':          { inventoryItemId: '55943751172395', variantId: '53856465748267' },

  // ── Spare Wheel Carrier ──
  'CD-SWH':            { inventoryItemId: '55995558953259', variantId: '53908200390955' },
  'CD-SWH-SHB':        { inventoryItemId: '55995558887723', variantId: '53908200325419' },
  'CD-SWH-W':          { inventoryItemId: '55995558920491', variantId: '53908200358187' },
};

async function main() {
  let matched = 0, notFound = 0;

  for (const [sku, { inventoryItemId, variantId }] of Object.entries(BINDINGS)) {
    const res = await pool.query(
      `UPDATE "Product"
       SET "shopifyInventoryItemId" = $1, "shopifyVariantId" = $2
       WHERE sku = $3
       RETURNING sku`,
      [inventoryItemId, variantId, sku]
    );
    if (res.rows.length === 0) {
      console.log(`NOT FOUND in Portal: ${sku}`);
      notFound++;
    } else {
      console.log(`OK  ${sku} → itemId=${inventoryItemId}`);
      matched++;
    }
  }

  console.log(`\nDone: ${matched} bound, ${notFound} not found in Portal`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
