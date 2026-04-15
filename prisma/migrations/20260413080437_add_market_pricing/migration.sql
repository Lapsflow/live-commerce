-- CreateTable
CREATE TABLE "MarketPricing" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productUrl" TEXT,
    "minPrice" INTEGER NOT NULL,
    "maxPrice" INTEGER NOT NULL,
    "avgPrice" INTEGER NOT NULL,
    "priceCount" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPricing_barcode_platform_idx" ON "MarketPricing"("barcode", "platform");

-- CreateIndex
CREATE INDEX "MarketPricing_fetchedAt_idx" ON "MarketPricing"("fetchedAt");
