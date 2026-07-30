const { Client } = require('pg');

const DB_URL = 'postgresql://postgres:SHufVETPyuJhEckjrUldCjPZPkxrkVvv@tokaido.proxy.rlwy.net:43176/railway';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const salesRecordCols = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'SalesRecord' ORDER BY ordinal_position"
  );
  console.log('=== SalesRecord columns ===');
  console.log(JSON.stringify(salesRecordCols.rows.map(r => r.column_name)));

  const salesLineCols = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'SalesLine' ORDER BY ordinal_position"
  );
  console.log('\n=== SalesLine columns ===');
  console.log(JSON.stringify(salesLineCols.rows.map(r => r.column_name)));

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('\n=== All public tables ===');
  console.log(JSON.stringify(tables.rows.map(r => r.table_name)));

  const migrations = await client.query(
    'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at'
  );
  console.log('\n=== Applied migrations ===');
  console.log(JSON.stringify(migrations.rows.map(r => r.migration_name)));

  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
