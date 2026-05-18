-- 1. Order.seller: onDelete: Cascade
ALTER TABLE "Order" DROP CONSTRAINT "Order_sellerId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE;

-- 2. Broadcast.seller: onDelete: Cascade
ALTER TABLE "Broadcast" DROP CONSTRAINT "Broadcast_sellerId_fkey";
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE;

-- 3. Sale.sellerId: nullable + onDelete: SetNull
ALTER TABLE "Sale" ALTER COLUMN "sellerId" DROP NOT NULL;
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_sellerId_fkey";
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL;

-- 4. Proposal.submittedBy: nullable + onDelete: SetNull
ALTER TABLE "Proposal" ALTER COLUMN "submittedBy" DROP NOT NULL;
ALTER TABLE "Proposal" DROP CONSTRAINT "Proposal_submittedBy_fkey";
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL;

-- 5. ScanLog.userId: nullable + onDelete: SetNull (Cascade → SetNull)
ALTER TABLE "ScanLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "ScanLog" DROP CONSTRAINT "ScanLog_userId_fkey";
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
