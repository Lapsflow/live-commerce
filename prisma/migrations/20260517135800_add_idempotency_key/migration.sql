-- CreateTable "IdempotencyKey"
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" JSONB,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable "UploadJob"
CREATE TABLE "UploadJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_userId_createdAt_idx" ON "IdempotencyKey"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadJob_userId_createdAt_idx" ON "UploadJob"("userId", "createdAt");
