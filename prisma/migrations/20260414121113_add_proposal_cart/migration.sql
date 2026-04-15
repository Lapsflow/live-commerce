-- CreateTable
CREATE TABLE "ProposalCart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "samplePrice" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalCart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProposalCart_userId_idx" ON "ProposalCart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalCart_userId_productId_key" ON "ProposalCart"("userId", "productId");

-- AddForeignKey
ALTER TABLE "ProposalCart" ADD CONSTRAINT "ProposalCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalCart" ADD CONSTRAINT "ProposalCart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
