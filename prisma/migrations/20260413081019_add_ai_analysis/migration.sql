-- CreateTable
CREATE TABLE "AIAnalysis" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "analysisType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "parsedData" JSONB NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageStats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "AIUsageStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIAnalysis_productId_idx" ON "AIAnalysis"("productId");

-- CreateIndex
CREATE INDEX "AIAnalysis_barcode_idx" ON "AIAnalysis"("barcode");

-- CreateIndex
CREATE INDEX "AIAnalysis_createdAt_idx" ON "AIAnalysis"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageStats_date_key" ON "AIUsageStats"("date");

-- AddForeignKey
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
