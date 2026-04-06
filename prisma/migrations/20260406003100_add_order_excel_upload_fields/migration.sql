/*
  Warnings:

  - You are about to drop the column `totalPrice` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `OrderItem` table. All the data in the column will be lost.
  - Added the required column `barcode` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `margin` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productName` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplyPrice` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalSupply` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "recipient" TEXT,
ADD COLUMN     "totalMargin" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "totalPrice",
DROP COLUMN "unitPrice",
ADD COLUMN     "barcode" TEXT NOT NULL,
ADD COLUMN     "margin" INTEGER NOT NULL,
ADD COLUMN     "productName" TEXT NOT NULL,
ADD COLUMN     "supplyPrice" INTEGER NOT NULL,
ADD COLUMN     "totalSupply" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Order_sellerId_uploadedAt_idx" ON "Order"("sellerId", "uploadedAt");

-- CreateIndex
CREATE INDEX "Order_orderNo_idx" ON "Order"("orderNo");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
