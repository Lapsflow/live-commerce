-- 샘플 상태 2단계 정리 (한국무진 요구 2026-07-03: 진행중 / 품절)
-- 1) SOLD_OUT(품절) 값 추가
ALTER TYPE "SampleStatus" ADD VALUE IF NOT EXISTS 'SOLD_OUT';

-- 2) 기존 UNTIL_SOLD(소진후 종료) 데이터는 진행중으로 이관
--    (품절 여부는 이후 마스터가 /samples/manage 에서 직접 관리)
UPDATE "Product" SET "sampleStatus" = 'CONTINUOUS' WHERE "sampleStatus" = 'UNTIL_SOLD';
