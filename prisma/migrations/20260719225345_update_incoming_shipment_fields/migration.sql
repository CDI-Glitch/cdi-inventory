-- AlterTable IncomingShipment: replace old fields with new schema
ALTER TABLE "IncomingShipment" RENAME COLUMN "reference" TO "poRef";
ALTER TABLE "IncomingShipment" ALTER COLUMN "poRef" SET NOT NULL;
ALTER TABLE "IncomingShipment" ALTER COLUMN "poRef" SET DEFAULT '';
ALTER TABLE "IncomingShipment" ADD CONSTRAINT "IncomingShipment_poRef_key" UNIQUE ("poRef");

ALTER TABLE "IncomingShipment" RENAME COLUMN "supplier" TO "supplierName";
ALTER TABLE "IncomingShipment" ALTER COLUMN "supplierName" SET NOT NULL;
ALTER TABLE "IncomingShipment" ALTER COLUMN "supplierName" SET DEFAULT '';

ALTER TABLE "IncomingShipment" ADD COLUMN IF NOT EXISTS "poNumber" TEXT;
ALTER TABLE "IncomingShipment" ALTER COLUMN "createdBy" SET DEFAULT 'system';

-- Drop trackingNo (kept in schema as-is, no action needed)

-- AlterTable IncomingLine: replace old fields with new schema
ALTER TABLE "IncomingLine" RENAME COLUMN "expectedQty" TO "qtyOrdered";
ALTER TABLE "IncomingLine" ADD COLUMN IF NOT EXISTS "qtyReceived" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IncomingLine" ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(65,30);
ALTER TABLE "IncomingLine" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "IncomingLine" DROP COLUMN IF EXISTS "actualQty";

-- Remove defaults used for migration
ALTER TABLE "IncomingShipment" ALTER COLUMN "poRef" DROP DEFAULT;
ALTER TABLE "IncomingShipment" ALTER COLUMN "supplierName" DROP DEFAULT;
