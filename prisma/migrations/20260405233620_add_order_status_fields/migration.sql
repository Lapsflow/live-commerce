-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "ShippingStatus" AS ENUM ('PENDING', 'PREPARING', 'SHIPPED', 'PARTIAL');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "shippingStatus" "ShippingStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Order_paymentStatus_shippingStatus_idx" ON "Order"("paymentStatus", "shippingStatus");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
