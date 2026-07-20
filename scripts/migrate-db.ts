/**
 * One-time migration script: copy all data from old DB to new DB.
 * Run with: npx tsx scripts/migrate-db.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const OLD_URL =
  "postgresql://postgres:FhEiTgHKlOAZinwwkotoaGBxFwjEzdDh@centerbeam.proxy.rlwy.net:52876/railway";
const NEW_URL =
  "postgresql://postgres:SHufVETPyuJhEckjrUldCjPZPkxrkVvv@tokaido.proxy.rlwy.net:43176/railway";

function makeClient(url: string) {
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

async function main() {
  const src = makeClient(OLD_URL);
  const dst = makeClient(NEW_URL);

  console.log("Connecting to both databases...");

  // ── 1. Users ──────────────────────────────────────────────
  const users = await src.user.findMany();
  console.log(`Migrating ${users.length} users...`);
  for (const r of users) {
    await dst.user.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 2. Locations ──────────────────────────────────────────
  const locations = await src.location.findMany();
  console.log(`Migrating ${locations.length} locations...`);
  for (const r of locations) {
    await dst.location.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 3. Products ───────────────────────────────────────────
  const products = await src.product.findMany();
  console.log(`Migrating ${products.length} products...`);
  for (const r of products) {
    await dst.product.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 4. BundleDefinitions ──────────────────────────────────
  const bundles = await src.bundleDefinition.findMany();
  console.log(`Migrating ${bundles.length} bundle definitions...`);
  for (const r of bundles) {
    await dst.bundleDefinition.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 5. BundleItems ────────────────────────────────────────
  const bundleItems = await src.bundleItem.findMany();
  console.log(`Migrating ${bundleItems.length} bundle items...`);
  for (const r of bundleItems) {
    await dst.bundleItem.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 6. SalesRecords ───────────────────────────────────────
  const sales = await src.salesRecord.findMany();
  console.log(`Migrating ${sales.length} sales records...`);
  for (const r of sales) {
    await dst.salesRecord.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 8. GeneratedMovements ─────────────────────────────────
  const movements = await src.generatedMovement.findMany();
  console.log(`Migrating ${movements.length} generated movements...`);
  for (const r of movements) {
    await dst.generatedMovement.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 9. InventoryLogs ──────────────────────────────────────
  const logs = await src.inventoryLog.findMany();
  console.log(`Migrating ${logs.length} inventory logs...`);
  for (const r of logs) {
    await dst.inventoryLog.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 10. IncomingShipments ─────────────────────────────────
  const shipments = await src.incomingShipment.findMany();
  console.log(`Migrating ${shipments.length} incoming shipments...`);
  for (const r of shipments) {
    await dst.incomingShipment.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 11. IncomingLines ─────────────────────────────────────
  const incomingLines = await src.incomingLine.findMany();
  console.log(`Migrating ${incomingLines.length} incoming lines...`);
  for (const r of incomingLines) {
    await dst.incomingLine.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 12. Transfers ─────────────────────────────────────────
  const transfers = await src.transfer.findMany();
  console.log(`Migrating ${transfers.length} transfers...`);
  for (const r of transfers) {
    await dst.transfer.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 13. ProcessedWebhooks ─────────────────────────────────
  const webhooks = await src.processedWebhook.findMany();
  console.log(`Migrating ${webhooks.length} processed webhooks...`);
  for (const r of webhooks) {
    await dst.processedWebhook.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // ── 14. SyncLogs ──────────────────────────────────────────
  const syncLogs = await src.syncLog.findMany();
  console.log(`Migrating ${syncLogs.length} sync logs...`);
  for (const r of syncLogs) {
    await dst.syncLog.upsert({ where: { id: r.id }, update: r, create: r });
  }

  await src.$disconnect();
  await dst.$disconnect();

  console.log("\n✅ Migration complete! All data copied to new database.");
}

main().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
