-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('HEADQUARTERS', 'CENTER');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "productType" "ProductType";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'HEADQUARTERS';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isWmsProduct" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "managedBy" TEXT,
ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'HEADQUARTERS';

-- CreateIndex
CREATE INDEX "Order_productType_idx" ON "Order"("productType");

-- CreateIndex
CREATE INDEX "OrderItem_productType_idx" ON "OrderItem"("productType");

-- CreateIndex
CREATE INDEX "Product_productType_idx" ON "Product"("productType");

-- CreateIndex
CREATE INDEX "Product_managedBy_idx" ON "Product"("managedBy");
