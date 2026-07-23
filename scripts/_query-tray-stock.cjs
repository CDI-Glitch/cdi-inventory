const { Pool } = require('pg');
const pool = new Pool({
  host: 'tokaido.proxy.rlwy.net', port: 43176, user: 'postgres',
  password: 'SHufVETPyuJhEckjrUldCjPZPkxrkVvv', database: 'railway',
  ssl: { rejectUnauthorized: false }
});
const query = `
  SELECT p.sku, p.name, l.name as location, COALESCE(SUM(il.delta),0) as on_hand
  FROM "Product" p
  LEFT JOIN "InventoryLog" il ON il."productId" = p.id
  LEFT JOIN "Location" l ON l.id = il."locationId"
  WHERE p.sku IN ('T-Tray-1605-SHB','Ttay-1805-SHB','T-Tray-1805-SHB')
  GROUP BY p.sku, p.name, l.name
  ORDER BY p.sku
`;
pool.query(query)
  .then(r => {
    if (!r.rows.length) { console.log('No rows'); return; }
    r.rows.forEach(x => console.log(x.sku, '|', x.name, '| loc:', x.location, '| on_hand:', x.on_hand));
  })
  .catch(console.error)
  .finally(() => pool.end());
