# ONEWMS 가격 동기화 진단 가이드

**목적**: 특정 상품의 공급가가 ONEWMS에서 수정되었을 때, 슈퍼무진에 반영되는 과정을 전체 진단

**예시**: 1406번 상품 공급가가 ONEWMS에서 5,100원 → 11,900원으로 변경되었는데, 슈퍼무진에는 언제 반영되는가?

---

## 📊 진단 방식 (2가지)

### 1️⃣ CLI 스크립트 (데이터 진단)

DB + ONEWMS API를 직접 쿼리하여 현재 상태를 진단합니다.

```bash
pnpm tsx scripts/diagnose-product-price.ts 1406
```

**출력 4단계**:

| 단계 | 검증 항목 | 예시 출력 |
|---|---|---|
| A | 슈퍼무진 DB의 1406번 상태 | `code: WMS-1406`, `supplyPrice: 5100` |
| B | ONEWMS API 직접 호출 | `product_id: 1406`, `supply_price: 11900` |
| C | DB의 마지막 sync 이력 | `syncedAt: 2026-05-13T10:30:00Z`, `syncStatus: success` |
| D | 자동 케이스 판별 | `결론: [A] 우리 동기화 실패` |

**결론 4가지**:

- **[A]**: ❌ 우리 DB는 5,100이지만 ONEWMS는 11,900 → **동기화 실패**
- **[B]**: ⚠️ ONEWMS 측에서 예상과 다른 값 반환 → **ONEWMS 캐시 또는 오류**
- **[C]**: ✅ 이미 동기화됨 → **브라우저 캐시 문제**
- **[D]**: 🤔 DB/ONEWMS에 상품 없음 → **매핑 누락 또는 페이지 한도**

---

### 2️⃣ Playwright 테스트 (브라우저 + API 검증)

6개 시나리오로 UI + API + Cron을 통합 검증합니다.

```bash
pnpm playwright test tests/e2e/price-sync-diagnosis-2026-05-13.spec.ts --reporter=list
```

**6개 시나리오**:

| T# | 시나리오 | 검증 대상 |
|---|---|---|
| T01 | 마스터 로그인 → 상품 관리 → "1406" 검색 | 화면 표시 공급가 |
| T02 | GET /api/products?search=1406 | API 응답 supplyPrice |
| T03 | GET /api/cron/stock-sync (CRON_SECRET 필요) | Cron 실행 + 가격 동기화 통계 |
| T04 | T03 후 5초 대기 → 재조회 | 가격 변경 감지 |
| T05 | ONEWMS API 직접 호출 (env 필요) | ONEWMS supply_price |
| T06 | 종합 결론 | `docs/PRICE_SYNC_DIAGNOSIS_REPORT.md` 자동 생성 |

**자동 생성 파일**:
- `docs/PRICE_SYNC_DIAGNOSIS_REPORT.md` — 6개 테스트 결과를 마크다운 표로 정리

---

## 🚀 실행 순서

### Step 1: CLI 진단 (기본)

운영 환경에서 현재 상태 확인:

```bash
pnpm tsx scripts/diagnose-product-price.ts 1406
```

**예상 출력**:

```
================================================================================
🔍 가격 동기화 진단: 상품 1406
================================================================================

📋 [A] 슈퍼무진 DB 조회...
✅ 찾음: 1406번 상품
   - code: WMS-1406
   - onewmsCode: 1406
   - supplyPrice: 5100원
   - updatedAt: 2026-05-12T15:30:00Z

📡 [B] ONEWMS API 조회...
✅ 찾음 (page 1): 1406번 상품
   - product_id: 1406
   - supply_price: 11900원

⏰ [C] 최근 Sync 이력...
✅ 최근 Sync: 2026-05-13T10:30:00Z
   - Status: success

📊 [D] 결론...

결론: [A]
메시지: ❌ 우리 DB는 5,100원이지만 ONEWMS는 11,900원 — 동기화가 실패한 상태입니다.

권장 조치:
1) /api/cron/stock-sync 가 정상 동작하는지 확인
2) lib/services/onewms/productImport.ts:syncProductPricesFromOnewms 가 1406을 제대로 찾는지 디버깅
3) HEADQUARTERS 상품만 동기화되므로 productType 확인 필수
4) cron 로그에 "Price sync done: X/Y updated" 메시지 확인

================================================================================
```

### Step 2: Playwright 테스트 (선택)

정상 작동을 유효성 검사:

```bash
# 필수 환경변수 확인
echo $CRON_SECRET          # ✅ 설정되어야 함
echo $ONEWMS_PARTNER_KEY   # ✅ 설정되어야 함
echo $ONEWMS_DOMAIN_KEY    # ✅ 설정되어야 함

# 테스트 실행
pnpm playwright test tests/e2e/price-sync-diagnosis-2026-05-13.spec.ts --reporter=list
```

**자동 생성 결과**:
- `docs/PRICE_SYNC_DIAGNOSIS_REPORT.md` 생성됨
- 6개 테스트 결과를 마크다운 표로 정리

---

## 📋 결론별 후속 조치

### 결론 [A]: 우리 동기화 실패

**증상**: 우리 DB=5,100, ONEWMS=11,900

**원인**: `/api/cron/stock-sync` cron이 정상 작동하지 않음

**조치**:

1. **Cron 동작 확인**:
   ```bash
   # 운영 환경 Vercel 로그 확인
   # https://vercel.com/your-team/live-commerce → Deployments → Logs
   # "Cron stock sync" 메시지가 매분 출력되는지 확인
   ```

2. **lib/services/onewms/productImport.ts 디버깅**:
   ```typescript
   // syncProductPricesFromOnewms() 함수에서:
   // - page 20 루프가 정상인지 확인
   // - onewmsProducts.get('1406') 이 정상 작동하는지 확인
   // - Product.update() 가 HEADQUARTERS 타입만 업데이트하는지 확인
   ```

3. **상품 타입 확인**:
   ```bash
   pnpm prisma studio
   # Product 테이블 → 1406번 → productType = "HEADQUARTERS"인지 확인
   # (CENTER 타입은 동기화되지 않음)
   ```

4. **1분 후 재실행**:
   ```bash
   # 대표님께: "Cron이 1분마다 돕니다. 1분 대기 후 재확인해주세요."
   ```

### 결론 [B]: ONEWMS 캐시 또는 오류

**증상**: ONEWMS API가 예상과 다른 값 반환

**원인**: ONEWMS 측 캐시 또는 데이터 불일치

**조치**:

1. **ONEWMS 측에 확인**:
   - "상품 1406번의 공급가를 어떻게 설정했나요?"
   - ONEWMS 웹 UI에서 직접 확인

2. **1-2분 대기 후 재실행**:
   ```bash
   # ONEWMS API 캐시 해제 대기
   sleep 120
   pnpm tsx scripts/diagnose-product-price.ts 1406
   ```

3. **예상값 vs 현재값 정리**:
   ```
   예상 공급가: 11,900원
   ONEWMS API 반환: ?????원
   차이: 왜일까?
   ```

### 결론 [C]: 이미 동기화됨 (브라우저 캐시)

**증상**: DB=11,900, ONEWMS=11,900 (일치) 하지만 화면에는 5,100으로 표시

**원인**: 브라우저 캐시 또는 오래된 세션

**조치**:

1. **브라우저 캐시 초기화**:
   ```
   - Windows: Ctrl+Shift+Delete
   - Mac: Cmd+Shift+Delete
   ```

2. **쿠키 / 세션 삭제**:
   ```
   DevTools → Application → Cookies → supermujin.ai 삭제
   ```

3. **새 시크릿 창에서 재접속**:
   ```
   Ctrl+Shift+N (Windows) 또는 Cmd+Shift+N (Mac)
   https://www.supermujin.ai 접속
   ```

### 결론 [D]: DB/ONEWMS에 상품 없음

**증상**: 상품을 찾을 수 없음

**원인**: 매핑 누락 또는 페이지 한도 초과

**조치**:

1. **상품 코드 형식 확인**:
   - productCode: "1406" vs "01406" vs "001406"?
   - onewmsCode: "1406" vs "1406" (형식 일치)?

2. **페이지 한도 확인**:
   ```typescript
   // lib/services/onewms/productImport.ts:378
   for (let page = 1; page <= 20; page++) {  // ← 현재 20 (=2,000개 상품)
   ```
   - ONEWMS 전체 상품이 2,000개를 초과하면?
   - 페이지 한도 20 → 50으로 증가 검토

3. **ONEWMS 측 확인**:
   - 상품 1406이 ONEWMS에 정말 존재하는가?
   - 활성 상태인가?

---

## 🔧 환경 설정 확인

필수 환경변수 (`.env` 또는 Vercel secrets):

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# ONEWMS Integration
ONEWMS_PARTNER_KEY="52bd55d7..."
ONEWMS_DOMAIN_KEY="eb731e19..."
ONEWMS_API_URL="https://api.onewms.co.kr/api.php"

# Cron Job Security
CRON_SECRET="7fad87f6..."
```

**확인**:

```bash
# 로컬
cat .env | grep ONEWMS

# Vercel
vercel env list | grep ONEWMS
```

---

## 📊 가격 동기화 흐름도

```
ONEWMS API (11,900원)
    ↓
    ├─ 매시간 cron job 실행
    │  └─ lib/services/onewms/productImport.ts:syncProductPricesFromOnewms()
    │     └─ HEADQUARTERS 상품만 처리
    │        └─ supply_price 업데이트
    ↓
Product.supplyPrice = 11,900원 (DB 반영)
    ↓
    ├─ /api/products?search=1406 (API 응답)
    │  └─ supplyPrice: 11900
    ↓
UI 화면 표시 (보통 1분 내에 반영)
    └─ "11,900원" 표시

⚠️  문제: 브라우저 캐시되어 있으면 "5,100원" 계속 표시
```

---

## 🧪 테스트 케이스

### 테스트 1: 정상 동기화

```bash
# ONEWMS에서 상품 가격을 11,900원으로 설정
# ↓ 1분 대기
# ↓ 진단 실행
pnpm tsx scripts/diagnose-product-price.ts 1406

# 예상: [C] 이미 동기화됨
```

### 테스트 2: 동기화 실패 재현

```bash
# DB에서 수동으로 가격을 변경
# UPDATE Product SET supplyPrice = 5100 WHERE onewmsCode = '1406'
# ↓ ONEWMS에는 11,900원 유지
# ↓ cron을 의도적으로 비활성화
# ↓ 진단 실행
pnpm tsx scripts/diagnose-product-price.ts 1406

# 예상: [A] 우리 동기화 실패
```

### 테스트 3: Playwright 통합 테스트

```bash
pnpm playwright test tests/e2e/price-sync-diagnosis-2026-05-13.spec.ts --reporter=list

# 자동 생성: docs/PRICE_SYNC_DIAGNOSIS_REPORT.md
```

---

## 📝 로그 위치

### Vercel 프로덕션 로그

```
https://vercel.com/your-team/live-commerce
→ Deployments
→ Production
→ Logs
```

**검색 키워드**:
- "Price sync done"
- "Stock sync completed"
- "Cron stock sync failed"

### 로컬 개발 로그

```bash
npm exec pnpm -- dev

# Console 출력:
# Cron stock sync started...
# Price sync done: 5/100 updated
```

---

## 🚨 실패 케이스 0건 목표

| 케이스 | 검증 방법 | 성공 기준 |
|---|---|---|
| A: 동기화 실패 | CLI 진단 + 로그 확인 | cron 정상 + DB 반영됨 |
| B: ONEWMS 오류 | API 직접 호출 | ONEWMS 값 일치 |
| C: 브라우저 캐시 | 새 시크릿 창 + 캐시 초기화 | UI 표시 갱신됨 |
| D: 매핑 누락 | onewmsCode 확인 + 페이지 한도 | 상품 발견 또는 한도 확대 |

---

## 📞 빠른 문의 응답 템플릿

### 대표님 문의: "1406번 공급가 11,900원은 언제 반영되나요?"

```markdown
네, 확인해드렸습니다.

**현재 상태** (진단 완료):
- 슈퍼무진 DB: 5,100원
- ONEWMS: 11,900원
- 상태: [A] 동기화 되지 않은 상태

**원인**:
/api/cron/stock-sync 가 매 1분마다 실행되며 가격을 동기화합니다.
현재 아직 반영되지 않았으므로, 약 1분 기다리신 후 다시 확인해주세요.

**확인 방법**:
1. 브라우저 캐시 초기화: Ctrl+Shift+Delete
2. 새 시크릿 창에서 https://www.supermujin.ai 접속
3. 상품 관리 → "1406" 검색 → 공급가 확인

**여전히 5,100원 표시되면**:
저희가 기술팀에 즉시 알리겠습니다.
```

---

_가격 동기화 진단 완벽 가이드 | 실패 0건 목표_
