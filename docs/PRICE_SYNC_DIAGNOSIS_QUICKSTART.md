# 🚀 ONEWMS 가격 동기화 진단 — 빠른 시작

**상황**: 대표님이 "1406번 공급가 11,900원은 언제 반영되나요?" 라고 문의

**해결**: 아래 명령 1개로 진단 완료 (2분 이내)

---

## 🎯 진단 1단계: CLI 실행 (필수)

```bash
pnpm tsx scripts/diagnose-product-price.ts 1406
```

### 예상 출력 (3가지 중 1개)

#### ✅ [결론 C] 이미 반영됨
```
결론: [C]
메시지: ✅ 가격이 이미 동기화되어 있습니다.

권장 조치:
대표님 브라우저 캐시 새로고침을 시도해주세요.
(Ctrl+Shift+Delete)
```
→ **대응**: 브라우저 캐시 초기화 안내

---

#### ❌ [결론 A] 우리 동기화 실패
```
결론: [A]
메시지: ❌ 우리 DB는 5,100원이지만 ONEWMS는 11,900원 — 동기화가 실패한 상태입니다.

권장 조치:
1) /api/cron/stock-sync 가 정상 동작하는지 확인
2) HEADQUARTERS 상품만 동기화되므로 productType 확인 필수
3) cron 로그에 "Price sync done: X/Y updated" 메시지 확인
```
→ **대응**: 기술팀 긴급 점검

---

#### ⚠️ [결론 B] ONEWMS 캐시
```
결론: [B]
메시지: ⚠️ ONEWMS 측에서 예상과 다른 값 반환

권장 조치:
1) ONEWMS 측에 상품 1406번의 공급가를 다시 확인해주세요.
2) 1분 대기 후 재실행
```
→ **대응**: ONEWMS 측에 문의

---

#### 🤔 [결론 D] 상품 없음
```
결론: [D]
메시지: 상품이 슈퍼무진 DB에 없음 — 매핑 누락 또는 productCode 형식 문제

권장 조치:
1) productCode/onewmsCode 형식 재확인
2) ONEWMS 측에서 정말 상품이 존재하는지 확인
```
→ **대응**: 데이터 확인 / 매핑 필요

---

## 📊 진단 2단계: Playwright 테스트 (선택 - 상세 검증)

```bash
pnpm playwright test tests/e2e/price-sync-diagnosis-2026-05-13.spec.ts --reporter=list
```

**자동 생성 파일**:
- `docs/PRICE_SYNC_DIAGNOSIS_REPORT.md` (6개 테스트 결과 마크다운)

---

## 📋 결론별 대응 매뉴얼

### [C] 이미 반영됨 → 브라우저 캐시 문제

**대표님께 전달**:
```
좋은 소식입니다! 11,900원은 이미 우리 시스템에 반영되었습니다.
다만 브라우저 캐시 때문에 화면에는 아직 5,100원으로 보입니다.

아래 중 하나를 시도해주세요:
1) Ctrl+Shift+Delete (Windows) / Cmd+Shift+Delete (Mac) → 캐시 삭제
2) 새 시크릿 창 (Ctrl+Shift+N) → https://www.supermujin.ai 접속
3) 완전히 브라우저 종료 후 다시 접속
```

---

### [A] 우리 동기화 실패 → 긴급 기술팀 점검

**기술팀 체크리스트**:

```bash
# 1️⃣ Cron 로그 확인
# Vercel: https://vercel.com/your-team/live-commerce → Logs
# 검색: "Price sync done" 또는 "Cron stock sync failed"
# 최근 1분 내에 실행되었는가?

# 2️⃣ 상품 타입 확인
pnpm prisma studio
# Product 테이블 → 1406번 → productType = "HEADQUARTERS"?
# (CENTER 타입은 동기화 안 됨)

# 3️⃣ 수동 테스트
npm exec pnpm -- tsx scripts/diagnose-product-price.ts 1406
# 1분 후 재실행 → 값 변경되었나?

# 4️⃣ 페이지 한도 확인
grep -n "for (let page = 1" lib/services/onewms/productImport.ts
# 현재: page <= 20 (2,000개 상품)
# ONEWMS 전체 상품이 2,000개 초과면? → 한도 확대 필요
```

**즉시 조치**:
- Cron이 작동하지 않으면 → Vercel 배포 상태 확인
- HEADQUARTERS 타입 확인 → 없으면 마이그레이션 필요
- 페이지 한도 문제면 → page <= 50으로 수정

---

### [B] ONEWMS 캐시 → ONEWMS 측 확인

**ONEWMS 측에 전달**:
```
상품 1406번의 공급가가 다음과 같이 보입니다:
- 우리 시스템: 5,100원
- ONEWMS API 응답: ????원 (예상: 11,900원)

아래를 확인해주세요:
1) ONEWMS 웹 UI에서 상품 1406의 공급가 설정 값
2) API 캐시 또는 지연 가능성 (1-2분 대기 후 재확인)
```

---

### [D] 상품 없음 → 데이터 확인

**확인 사항**:

```bash
# 1️⃣ DB에 상품이 있는가?
pnpm prisma studio
# Product 테이블 검색: code="WMS-1406" 또는 onewmsCode="1406"
# 없으면: 상품 등록 필요

# 2️⃣ ONEWMS에 상품이 있는가?
npm exec pnpm -- tsx scripts/diagnose-product-price.ts 1406
# "ONEWMS에서 product_id=1406를 찾을 수 없습니다." 메시지 확인
# → ONEWMS 측에 확인 필요

# 3️⃣ 페이지 한도 초과?
# 현재: 페이지 20 = 최대 2,000개 상품
# ONEWMS 전체 상품이 2,000개 초과면?
# → lib/services/onewms/productImport.ts:378 에서 page <= 50으로 수정
```

---

## ⏱️ 소요 시간

| 단계 | 소요 시간 |
|---|---|
| 1. CLI 진단 | 10초 |
| 2. 결론 확인 | 10초 |
| 3. 대응 실행 | 1-5분 |
| **총합** | **2분 이내** |

---

## 🔍 각 상품마다 다르게 실행 가능

```bash
# 1406번 진단
pnpm tsx scripts/diagnose-product-price.ts 1406

# 다른 상품도 가능
pnpm tsx scripts/diagnose-product-price.ts 1407
pnpm tsx scripts/diagnose-product-price.ts WMS-1408
```

---

## 📞 대표님 FAQ

### Q: 왜 시간이 걸리나요?

**A**: Cron이 최대 1분마다 실행되기 때문입니다.
- 00분에 가격 변경 → 01분에 동기화 → 최대 2분 대기

### Q: 다시 확인하고 싶은데?

**A**: 언제든 아래 명령 실행:
```bash
pnpm tsx scripts/diagnose-product-price.ts 1406
```

### Q: 매번 5,100원 표시되면?

**A**: 기술팀에 연락. CLI 진단 결과를 함께 전달하세요.

---

## 🎯 정리

| 결론 | 메시지 | 대응 |
|---|---|---|
| **[C]** | ✅ 이미 반영 | 브라우저 캐시 초기화 |
| **[A]** | ❌ 우리 실패 | 기술팀 긴급 점검 |
| **[B]** | ⚠️ ONEWMS 오류 | ONEWMS 측 확인 |
| **[D]** | 🤔 상품 없음 | 데이터 확인 / 매핑 |

---

_빠른 진단 가이드 | 실패 0건 목표 | 2분 이내 해결_
