-- CreateTable: ONEWMS Integration Tables

-- Add ONEWMS fields to Product table
ALTER TABLE "Product" ADD COLUMN "onewmsCode" TEXT;
ALTER TABLE "Product" ADD COLUMN "onewmsBarcode" TEXT;

-- Create unique index on onewmsCode
CREATE UNIQUE INDEX "Product_onewmsCode_key" ON "Product"("onewmsCode");

-- CreateTable: OnewmsOrderMapping
CREATE TABLE "OnewmsOrderMapping" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "onewmsOrderNo" TEXT NOT NULL,
    "transNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "csStatus" INTEGER NOT NULL DEFAULT 0,
    "holdStatus" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnewmsOrderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OnewmsStockSync
CREATE TABLE "OnewmsStockSync" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "availableQty" INTEGER NOT NULL,
    "totalQty" INTEGER NOT NULL,
    "localQty" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnewmsStockSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OnewmsDeliveryLog
CREATE TABLE "OnewmsDeliveryLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "transNo" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedFrom" TEXT NOT NULL DEFAULT 'onewms',

    CONSTRAINT "OnewmsDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: OnewmsOrderMapping
CREATE UNIQUE INDEX "OnewmsOrderMapping_orderId_key" ON "OnewmsOrderMapping"("orderId");
CREATE UNIQUE INDEX "OnewmsOrderMapping_onewmsOrderNo_key" ON "OnewmsOrderMapping"("onewmsOrderNo");
CREATE INDEX "OnewmsOrderMapping_onewmsOrderNo_idx" ON "OnewmsOrderMapping"("onewmsOrderNo");
CREATE INDEX "OnewmsOrderMapping_status_idx" ON "OnewmsOrderMapping"("status");
CREATE INDEX "OnewmsOrderMapping_sentAt_idx" ON "OnewmsOrderMapping"("sentAt");

-- CreateIndex: OnewmsStockSync
CREATE INDEX "OnewmsStockSync_productId_idx" ON "OnewmsStockSync"("productId");
CREATE INDEX "OnewmsStockSync_syncedAt_idx" ON "OnewmsStockSync"("syncedAt");

-- CreateIndex: OnewmsDeliveryLog
CREATE INDEX "OnewmsDeliveryLog_orderId_idx" ON "OnewmsDeliveryLog"("orderId");
CREATE INDEX "OnewmsDeliveryLog_changedAt_idx" ON "OnewmsDeliveryLog"("changedAt");

-- AddForeignKey: OnewmsOrderMapping -> Order
ALTER TABLE "OnewmsOrderMapping" ADD CONSTRAINT "OnewmsOrderMapping_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OnewmsStockSync -> Product
ALTER TABLE "OnewmsStockSync" ADD CONSTRAINT "OnewmsStockSync_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OnewmsDeliveryLog -> Order
ALTER TABLE "OnewmsDeliveryLog" ADD CONSTRAINT "OnewmsDeliveryLog_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
