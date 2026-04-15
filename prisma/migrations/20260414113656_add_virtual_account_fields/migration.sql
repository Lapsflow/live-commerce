-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "virtualAccount" TEXT,
ADD COLUMN     "virtualAccountBank" TEXT,
ADD COLUMN     "virtualAccountExpiry" TIMESTAMP(3);
