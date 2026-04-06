-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avgSales" INTEGER,
ADD COLUMN     "channels" TEXT[] DEFAULT ARRAY[]::TEXT[];
