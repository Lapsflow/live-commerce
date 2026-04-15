-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "centerId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "processingCenterId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "masterBarcodeId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "centerId" TEXT;

-- CreateTable
CREATE TABLE "Center" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "regionName" TEXT NOT NULL,
    "representative" TEXT NOT NULL,
    "representativePhone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "addressDetail" TEXT,
    "businessNo" TEXT,
    "contractDate" TIMESTAMP(3),
    "contractDocument" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCenterStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCenterStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderSellerMatching" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchReason" TEXT,
    "orderCount" INTEGER NOT NULL DEFAULT 1,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" INTEGER NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recommendScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderSellerMatching_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "spreadsheetId" TEXT,
    "sheetName" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarcodeMaster" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "standardName" TEXT NOT NULL,
    "category" TEXT,
    "manufacturer" TEXT,
    "specifications" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "registeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarcodeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseInventory" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedFrom" TEXT,

    CONSTRAINT "WarehouseInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "fromWarehouseId" TEXT,
    "toWarehouseId" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "processedBy" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Center_code_key" ON "Center"("code");

-- CreateIndex
CREATE INDEX "Center_code_idx" ON "Center"("code");

-- CreateIndex
CREATE INDEX "Center_regionCode_idx" ON "Center"("regionCode");

-- CreateIndex
CREATE INDEX "Center_isActive_idx" ON "Center"("isActive");

-- CreateIndex
CREATE INDEX "ProductCenterStock_productId_idx" ON "ProductCenterStock"("productId");

-- CreateIndex
CREATE INDEX "ProductCenterStock_centerId_idx" ON "ProductCenterStock"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCenterStock_productId_centerId_key" ON "ProductCenterStock"("productId", "centerId");

-- CreateIndex
CREATE INDEX "OrderSellerMatching_orderId_idx" ON "OrderSellerMatching"("orderId");

-- CreateIndex
CREATE INDEX "OrderSellerMatching_sellerId_idx" ON "OrderSellerMatching"("sellerId");

-- CreateIndex
CREATE INDEX "OrderSellerMatching_productId_idx" ON "OrderSellerMatching"("productId");

-- CreateIndex
CREATE INDEX "OrderSellerMatching_recommendScore_idx" ON "OrderSellerMatching"("recommendScore");

-- CreateIndex
CREATE UNIQUE INDEX "OrderSellerMatching_sellerId_productId_key" ON "OrderSellerMatching"("sellerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_code_idx" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeMaster_barcode_key" ON "BarcodeMaster"("barcode");

-- CreateIndex
CREATE INDEX "BarcodeMaster_barcode_idx" ON "BarcodeMaster"("barcode");

-- CreateIndex
CREATE INDEX "BarcodeMaster_isActive_idx" ON "BarcodeMaster"("isActive");

-- CreateIndex
CREATE INDEX "WarehouseInventory_barcode_idx" ON "WarehouseInventory"("barcode");

-- CreateIndex
CREATE INDEX "WarehouseInventory_warehouseId_idx" ON "WarehouseInventory"("warehouseId");

-- CreateIndex
CREATE INDEX "WarehouseInventory_productId_idx" ON "WarehouseInventory"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseInventory_warehouseId_productId_key" ON "WarehouseInventory"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "StockMovement_barcode_idx" ON "StockMovement"("barcode");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_processedAt_idx" ON "StockMovement"("processedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCenterStock" ADD CONSTRAINT "ProductCenterStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCenterStock" ADD CONSTRAINT "ProductCenterStock_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSellerMatching" ADD CONSTRAINT "OrderSellerMatching_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSellerMatching" ADD CONSTRAINT "OrderSellerMatching_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSellerMatching" ADD CONSTRAINT "OrderSellerMatching_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_processingCenterId_fkey" FOREIGN KEY ("processingCenterId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_barcode_fkey" FOREIGN KEY ("barcode") REFERENCES "BarcodeMaster"("barcode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
