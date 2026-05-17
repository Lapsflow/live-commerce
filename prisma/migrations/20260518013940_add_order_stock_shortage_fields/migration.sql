-- Add Order model fields for stock shortage tracking
ALTER TABLE "Order" ADD COLUMN "stockShortageReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "stockShortageDetectedAt" TIMESTAMP(3);

-- Create index for filtering shortage detection
CREATE INDEX "Order_stockShortageDetectedAt_idx" ON "Order"("stockShortageDetectedAt");
