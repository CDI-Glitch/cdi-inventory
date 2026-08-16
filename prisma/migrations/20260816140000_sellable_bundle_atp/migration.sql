-- AlterTable
ALTER TABLE "BundleDefinition" ADD COLUMN "sellableSku" TEXT;
ALTER TABLE "BundleDefinition" ADD COLUMN "shopifyInventoryItemId" TEXT;
ALTER TABLE "BundleDefinition" ADD COLUMN "shopifyVariantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BundleDefinition_sellableSku_key" ON "BundleDefinition"("sellableSku");

-- AlterTable
ALTER TABLE "BundleItem" ADD COLUMN "nonConstraining" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BundleItem" ADD COLUMN "altGroupKey" TEXT;

-- CreateTable
CREATE TABLE "BundleLocationStock" (
    "id" TEXT NOT NULL,
    "bundleDefinitionId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "cachedKits" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundleLocationStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BundleLocationStock_bundleDefinitionId_locationId_key" ON "BundleLocationStock"("bundleDefinitionId", "locationId");

-- CreateIndex
CREATE INDEX "BundleLocationStock_bundleDefinitionId_idx" ON "BundleLocationStock"("bundleDefinitionId");

-- AddForeignKey
ALTER TABLE "BundleLocationStock" ADD CONSTRAINT "BundleLocationStock_bundleDefinitionId_fkey" FOREIGN KEY ("bundleDefinitionId") REFERENCES "BundleDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleLocationStock" ADD CONSTRAINT "BundleLocationStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
