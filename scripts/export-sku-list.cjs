// Export all SKUs from Railway DB to a markdown file for Codex comparison
// Run: node scripts/export-sku-list.cjs
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  host: "tokaido.proxy.rlwy.net",
  port: 43176,
  user: "postgres",
  password: "SHufVETPyuJhEckjrUldCjPZPkxrkVvv",
  database: "railway",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // Get all products
  const products = await pool.query(
    `SELECT sku, name, category, unit, "reorderPoint", active, "createdAt"
     FROM "Product"
     ORDER BY category ASC, sku ASC`
  );

  // Get opening stock (Brisbane)
  const stocks = await pool.query(`
    SELECT p.sku,
           l.name AS location,
           COALESCE(SUM(il.delta),0) AS "onHand"
    FROM "Product" p
    LEFT JOIN "InventoryLog" il ON il."productId" = p.id
    LEFT JOIN "Location" l ON l.id = il."locationId"
    GROUP BY p.sku, l.name
    ORDER BY p.sku, l.name
  `);

  // Build stock map: sku -> { Brisbane: n, Sydney: n }
  const stockMap = {};
  for (const row of stocks.rows) {
    if (!row.location) continue;
    if (!stockMap[row.sku]) stockMap[row.sku] = {};
    stockMap[row.sku][row.location] = parseInt(row.onHand);
  }

  // Group by category
  const byCategory = {};
  for (const p of products.rows) {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  }

  const now = new Date().toISOString().slice(0, 10);
  let md = `# CDI Inventory — SKU Master List\n\n`;
  md += `> 生成时间：${now}  \n`;
  md += `> 用途：供 Codex/Claude 对比哪些 SKU 已录入、哪些缺失  \n`;
  md += `> 总计：${products.rows.length} 个活跃 SKU，${Object.keys(byCategory).length} 个分类\n\n`;
  md += `---\n\n`;

  for (const [cat, items] of Object.entries(byCategory).sort()) {
    const label = cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    md += `## ${label} (${items.length})\n\n`;
    md += `| SKU | Name | Unit | On Hand (BNE) | On Hand (SYD) | Reorder |\n`;
    md += `|-----|------|------|:---:|:---:|:---:|\n`;
    for (const p of items) {
      const s = stockMap[p.sku] || {};
      const bne = s["Brisbane"] ?? 0;
      const syd = s["Sydney"] ?? 0;
      md += `| \`${p.sku}\` | ${p.name} | ${p.unit} | ${bne} | ${syd} | ${p.reorderPoint} |\n`;
    }
    md += `\n`;
  }

  const outPath = path.join(__dirname, "../docs/sku-master-list.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md, "utf8");
  process.stdout.write(`✅ Exported ${products.rows.length} SKUs to docs/sku-master-list.md\n`);
}

main().catch(console.error).finally(() => pool.end());
