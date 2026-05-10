-- PROPOSAL-07: 쇼핑몰형 카드용 추가 필드 (모두 NULL 허용)
ALTER TABLE "Proposal" ADD COLUMN "onlineLowestPrice" INTEGER;
ALTER TABLE "Proposal" ADD COLUMN "supplyPrice" INTEGER;
ALTER TABLE "Proposal" ADD COLUMN "expiryDate" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "stockQty" INTEGER;

-- 카테고리별 그룹 조회 성능을 위한 인덱스
CREATE INDEX "Proposal_category_idx" ON "Proposal"("category");
