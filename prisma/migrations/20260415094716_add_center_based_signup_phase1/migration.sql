-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contractApprovedAt" TIMESTAMP(3),
ADD COLUMN     "contractApprovedBy" TEXT,
ADD COLUMN     "contractRejectionReason" TEXT,
ADD COLUMN     "contractStatus" "ContractStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "ScanLog_centerId_scannedAt_idx" ON "ScanLog"("centerId", "scannedAt" DESC);
