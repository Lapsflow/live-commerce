# Claude Code 전달 — 가격 동기화 진단 + 1406번 상품 검증

> 대표님 카톡 문의 대응: "1406번 공급가가 5,100원으로 나오는데 11,900원으로 수정해서 11,900원으로 나와야 합니다. 리드타임이 어느 정도 걸리는지 문의드립니다."

다음 프롬프트 그대로 Claude Code에 붙여넣으세요.

---

## 📋 Claude Code 프롬프트

```
ONEWMS 가격 동기화 진단을 수행하고 1406번 상품의 실제 상태를 파악해줘.

## 배경

대표님 문의:
- 슈퍼무진 시스템에 상품 1406번 공급가가 5,100원으로 표시됨
- ONEWMS에서 공급가를 11,900원으로 수정했음
- 슈퍼무진에 11,900원이 언제 반영되는지 문의

검증해야 할 4가지:
1. 슈퍼무진 DB의 1406번 상품 현재 상태 (productType, onewmsCode, supplyPrice)
2. ONEWMS API 직접 호출 시 1406번이 어떻게 응답되는지
3. 가격 sync cron이 1분마다 실제 도는지 (Vercel 로그)
4. 가격 sync 결과 N/M updated 메시지가 매분 찍히는지

## 환경

- 운영 URL: https://www.supermujin.ai
- 운영 DB: process.env.DATABASE_URL (Neon Postgres)
- ONEWMS API: https://api.onewms.co.kr/api.php
- ONEWMS 인증: ONEWMS_PARTNER_KEY, ONEWMS_DOMAIN_KEY (env)
- 공식 문서: docs/ONEWMS_API_DOCUMENTATION.md, docs/ONEWMS_API_IMPLEMENTATION_MAP.md

## 작성할 산출물 (3개)

### 1. scripts/diagnose-product-price.ts (신규)

특정 상품(productCode 또는 onewmsCode) 1개의 가격/매핑 상태를 종합 진단.

사용:
  pnpm tsx scripts/diagnose-product-price.ts 1406

기능:
- 슈퍼무진 DB 조회:
  * Product 테이블에서 productCode='1406' 또는 onewmsCode='1406'으로 찾기
  * 출력: id, productCode, onewmsCode, productType, name, supplyPrice, sellPrice, isActive, updatedAt
  * 못 찾으면: 검색어 변형 시도 (예: '1406', '[1406]', '11406', '01406')
- ONEWMS API 직접 호출:
  * get_product_info API로 1406번 직접 조회 (action=get_product_info, product_id=1406 또는 우리 onewmsCode)
  * 응답에서 supply_price, shop_price, org_price 추출
  * 출력: ONEWMS 실제 응답값 vs 우리 DB값 비교
- 최근 sync 이력:
  * OnewmsStockSync 테이블에서 해당 productId 의 최근 10건 syncedAt 조회
  * 가장 최근 sync 시각 출력

스크립트 구조 (참고용 - resolve-all-stock-conflicts.ts 와 동일한 패턴 사용):
  import { PrismaClient } from '../lib/generated/prisma/client';
  import { PrismaNeon } from '@prisma/adapter-neon';
  import { createOnewmsClient } from '../lib/onewms';
  import 'dotenv/config';

  const args = process.argv.slice(2);
  const productCode = args[0];
  if (!productCode) { console.error('Usage: pnpm tsx scripts/diagnose-product-price.ts <productCode>'); process.exit(1); }

### 2. tests/e2e/price-sync-diagnosis.spec.ts (신규)

가격 sync cron 동작을 Playwright로 검증.

시나리오 (총 6개):

T01: 마스터 로그인 → /products → 검색 "1406" → 상세보기 → 표시되는 공급가 캡처
  - 현재 슈퍼무진 화면의 1406 공급가가 얼마인지 확인

T02: GET /api/products?search=1406 (마스터 토큰) → 응답에서 1406 supplyPrice 확인
  - API 응답이 화면과 일치하는지

T03: 가격 sync cron 동작 검증
  - Vercel 환경에서는 직접 cron 호출 불가, 대신
  - POST /api/cron/stock-sync (CRON_SECRET bearer auth) 직접 호출
  - 응답에서 priceStats.updated > 0 또는 priceStats.total > 0 확인
  - 응답 시간 < 60초

T04: T03 직후 다시 GET /api/products?search=1406
  - sync 호출 후 supplyPrice가 변경됐는지 확인
  - 만약 변경 안 됐으면 ONEWMS 측에서도 옛날 값 반환 중

T05: ONEWMS 측 응답 직접 검증 (curl 또는 fetch)
  - process.env.ONEWMS_PARTNER_KEY, ONEWMS_DOMAIN_KEY 사용
  - POST https://api.onewms.co.kr/api.php
    body: partner_key=XXX&domain_key=XXX&action=get_product_info&page=1&limit=100
  - 응답에서 product_id=1406 (또는 우리 onewmsCode) 찾기
  - 그 항목의 supply_price 값 확인
  - 11,900원이면 ONEWMS는 정상, 5,100원이면 ONEWMS 측 캐시/지연

T06: 결론 출력 — 5개 시나리오 결과 종합
  - 슈퍼무진 화면값 / 슈퍼무진 API값 / Cron 동작 여부 / ONEWMS API값
  - 4가지 가능 결론:
    A) ONEWMS=11,900 + 우리=5,100 → 우리 sync 안 됨 (cron 또는 매핑 문제)
    B) ONEWMS=5,100 + 우리=5,100 → ONEWMS 측 캐시/지연 (그쪽 문의 필요)
    C) ONEWMS=11,900 + 우리=11,900 → 이미 반영됨 (대표님 화면이 캐시)
    D) ONEWMS 응답에 1406 없음 → 페이지 한도 초과 (현재 20 pages × 100 = 2,000) 또는 매핑 누락

### 3. docs/PRICE_SYNC_DIAGNOSIS_REPORT.md (신규)

위 6개 시나리오 실행 결과 자동 생성.

마크다운 형식:
```
# 가격 동기화 진단 보고서

## 상품 1406번 상태

| 검증 항목 | 값 |
|---|---|
| 슈퍼무진 화면 supplyPrice | (T01 결과) |
| 슈퍼무진 API supplyPrice | (T02 결과) |
| 우리 DB onewmsCode | (DB 조회 결과) |
| 우리 DB productType | (HEADQUARTERS / CENTER / 없음) |
| ONEWMS API 직접 응답 supply_price | (T05 결과) |
| 마지막 sync 시각 | (DB 조회 결과) |

## Cron 동작

| 항목 | 값 |
|---|---|
| /api/cron/stock-sync 응답 | (T03 status) |
| priceStats.total | (몇 개 상품 가격 체크했나) |
| priceStats.updated | (몇 개 업데이트됐나) |
| priceStats.errors | (실패 개수) |

## 결론

(A/B/C/D 중 하나 자동 판별 + 권장 조치)
```

## 실행 명령

```bash
# 1. 진단 스크립트 (DB + ONEWMS API 직접)
pnpm tsx scripts/diagnose-product-price.ts 1406

# 2. Playwright 검증
pnpm playwright test tests/e2e/price-sync-diagnosis.spec.ts --reporter=list
```

## 절대 하지 말 것

1. 운영 DB 데이터 수정/삭제 절대 금지 (읽기만 + 진단 sync는 정식 cron 사용)
2. ONEWMS API에 set_xxx 같은 쓰기 API 호출 금지 (get만)
3. 1406번이 아닌 다른 상품 값 변경 금지
4. tests/e2e/* 기존 파일 수정 금지 (신규 spec만 추가)
5. ONEWMS API rate limit 고려 — 본 진단 1회 실행 시 호출 5회 이내

## 환경/데이터 의존 SKIP 허용 케이스

다음 케이스는 SKIP 허용하되 사유 명시:

- ONEWMS 키 미설정 시 T05 SKIP: "ONEWMS_PARTNER_KEY env not configured"
- 1406번이 DB에 없으면 T01-T02 SKIP: "Product 1406 not found in supermujin DB"
- 1406번이 CENTER 타입이면 T03-T05 SKIP: "Price sync targets HEADQUARTERS only"

## 보고 형식

검증 끝나면 다음 한 줄로 요약:
"가격 sync 진단 결과: [A/B/C/D] - [구체적 이유]
실행 명령으로 docs/PRICE_SYNC_DIAGNOSIS_REPORT.md 생성됨."

만약 결론이 A (우리 sync 안 됨) 이면 추가 hotfix 제안.
B (ONEWMS 측 문제) 이면 대표님께 ONEWMS 측 문의 권고.
C (이미 반영) 이면 대표님 브라우저 캐시 새로고침 안내.
D (페이지 한도) 이면 productImport.ts 의 페이지 한도 늘리는 작업.
```

---

## 🎯 이 프롬프트의 핵심

| 단계 | 무엇을 확인하는가 |
|---|---|
| T01 | 슈퍼무진 화면 — 대표님이 보시는 가격 |
| T02 | 슈퍼무진 API — 화면과 일치하는지 |
| T03 | Cron 실행 — 가격 sync가 실제로 도는지 |
| T04 | Sync 후 값 변경 — 우리 sync 효과 있는지 |
| T05 | **ONEWMS 직접 호출** — 그쪽이 무슨 값 반환하는지 (진실 확인) |
| T06 | 4가지 결론(A/B/C/D) 자동 판별 |

### 결론별 다음 액션

| 결론 | 의미 | 대응 |
|---|---|---|
| **A** | ONEWMS=11,900, 우리=5,100 | 우리 sync 버그 → 핫픽스 |
| **B** | ONEWMS=5,100, 우리=5,100 | ONEWMS 측 캐시 → 그쪽 문의 |
| **C** | 둘 다 11,900 | 대표님 화면 캐시 → 새로고침 |
| **D** | ONEWMS 응답에 1406 없음 | 페이지 한도 초과 → 코드 수정 |

이 한 번의 검증으로 **진짜 원인이 어디 있는지 명확하게 판별**됩니다.
