# Scripts

유틸리티 스크립트 모음입니다.

## 샘플 데이터 생성

### seed-sample-products.ts

E2E 테스트를 위한 샘플 제품 데이터를 생성합니다.

**생성되는 데이터**:
- CENTER 타입 제품 5개 (자사몰 제품)
- HEADQUARTERS 타입 제품 3개 (WMS/본사 제품)

**실행 방법**:
```bash
npx tsx scripts/seed-sample-products.ts
```

**생성되는 제품 목록**:

| 타입 | 상품명 | 바코드 | 가격 |
|------|--------|--------|------|
| CENTER | 삼성 갤럭시 충전기 | 8801234567890 | 25,000원 |
| CENTER | LG 스마트폰 케이스 | 8801234567891 | 15,000원 |
| CENTER | 무선 이어폰 Pro | 8801234567892 | 89,000원 |
| CENTER | 스마트워치 밴드 | 8801234567893 | 35,000원 |
| CENTER | USB-C 케이블 3m | 8801234567894 | 12,000원 |
| HEADQUARTERS | [본사] 프리미엄 헤드폰 | 8809876543210 | 120,000원 |
| HEADQUARTERS | [본사] 무선 키보드 | 8809876543211 | 55,000원 |
| HEADQUARTERS | [본사] 게이밍 마우스 | 8809876543212 | 75,000원 |

**테스트 방법**:
1. 샘플 데이터 생성: `npx tsx scripts/seed-sample-products.ts`
2. 바코드 페이지 접속: https://live-commerce-opal.vercel.app/barcode
3. 바코드 입력:
   - CENTER 제품: `8801234567890`
   - WMS 제품: `8809876543210`
4. E2E 테스트 실행: `npm run test:e2e`

**주의사항**:
- HEADQUARTERS 제품은 `onewmsCode` 필드가 설정되어 있습니다
- 실제 OneWMS와 연동하려면 OneWMS에 동일한 제품 코드로 제품을 등록해야 합니다
- 중복 실행 시 기존 제품은 스킵됩니다
