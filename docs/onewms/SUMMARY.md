# ONEWMS Integration Summary

> 라이브 커머스 플랫폼의 ONEWMS-FMS API 통합 현황 문서
> 최종 업데이트: 2026-05-15

---

## 1️⃣ API 매핑 상태 (17 APIs)

| # | API | 상태 | 용도 | 구현 위치 |
|---|-----|------|------|---------|
| **P0 (운영 중)** |
| 1 | `set_orders` | ✅ ACTIVE | 발주 생성 | `lib/services/onewms/orderSync.ts` |
| 2 | `get_order_info` | ✅ ACTIVE | 발주 조회 | `lib/services/onewms/orderSync.ts` |
| 3 | `set_trans_no` | ✅ ACTIVE | 송장번호 입력 | `lib/services/onewms/deliverySync.ts` |
| 4 | `set_trans_pos` | ✅ ACTIVE | 송장 위치 업데이트 | `lib/services/onewms/deliverySync.ts` |
| 5 | `cancel_trans_pos` | ✅ ACTIVE | 송장 취소 | `lib/services/onewms/deliverySync.ts` |
| 6 | `get_stock_info` | ✅ ACTIVE | 재고 조회 | `lib/api/onewms/stock/[...route].ts` |
| 7 | `get_stock_tx_info` | ✅ ACTIVE | 재고 거래 내역 | `lib/api/onewms/stock/[...route].ts` |
| **P1 (구현 완료, 미사용)** |
| 8 | `add_product` | ✅ DONE | 상품 추가 | `lib/onewms/client.ts` |
| 9 | `get_product_list` | ✅ DONE | 상품 목록 조회 | `lib/onewms/client.ts` |
| 10 | `get_code_match` | ✅ DONE | 상품코드 매칭 | `lib/onewms/client.ts` |
| 11 | `add_sheet` | ✅ DONE | 입출고 전표 생성 | `lib/onewms/client.ts` |
| 12 | `add_sheet_items` | ✅ DONE | 전표 항목 추가 | `lib/onewms/client.ts` |
| 13 | `get_sheet_list` | ✅ DONE | 전표 목록 조회 | `lib/onewms/client.ts` |
| 14 | `get_transport_invoice` | ✅ DONE | 송장 이미지 조회 | `lib/onewms/client.ts` |
| 15 | `set_order_label` | ✅ DONE | 주문 라벨 설정 | `lib/onewms/client.ts` |
| 16 | `get_onedas_packing_no` | ✅ DONE | 패킹 작업 조회 | `lib/onewms/client.ts` |
| 17 | `get_onedas_packing_no_detail` | ✅ DONE | 패킹 상세 조회 | `lib/onewms/client.ts` |

**P0 vs P1 정의**:
- **P0**: 운영 환경에서 실제 사용 중. 발주 → 배송 흐름의 핵심 API.
- **P1**: 신규 기능/마켓플레이스 확장용 예비 API. 현재 화면/기능 미구현.

---

## 2️⃣ 설정 가이드 (3 Steps)

### Step 1: 환경 변수 설정

`.env.local` 파일에 다음 3개 변수 필수:

```bash
# ONEWMS API 인증
ONEWMS_PARTNER_KEY=52bd55d7d931cb002c8569099fe9bda1
ONEWMS_DOMAIN_KEY=eb731e190a51a6364185d7cf11641aa2

# 판매처 코드 (shop_id) — 선택적 (부트스트랩으로 자동 발견 가능)
ONEWMS_SHOP_ID=your_shop_id
```

**주의**: `ONEWMS_SHOP_ID` 없으면 `createOrder()` 호출 시 명시적 에러 발생.

### Step 2: shop_id 부트스트랩 (처음 1회만)

```bash
pnpm tsx scripts/onewms-bootstrap-shop.ts
```

실행 결과로 `shop_id` 자동 발견 → `.env.local`에 수동으로 추가.

### Step 3: API 클라이언트 초기화

```typescript
import { createOnewmsClient, setOnewmsConfig } from '@/lib/onewms';

// 수동 설정
setOnewmsConfig({
  partnerKey: process.env.ONEWMS_PARTNER_KEY!,
  domainKey: process.env.ONEWMS_DOMAIN_KEY!,
  shopId: process.env.ONEWMS_SHOP_ID,
});

const client = createOnewmsClient();
```

또는 자동 로드 (권장):
```typescript
const client = createOnewmsClient(); // env vars 자동 읽음
```

---

## 3️⃣ Known Assumptions (설계 가정 및 제약)

### A. 주문 데이터 매핑

| 필드 | ONEWMS 쪽 | LC 쪽 | 비고 |
|------|-----------|------|------|
| 발주번호 | `order_id` | `Order.onewmsOrderNo` | 형식: `LIVE-YYYYMMDD-XXXXX` |
| 상품코드 | `shop_product_id` | `Product.onewmsCode` | 상품별 고유 식별자 |
| 수령자명 | `recv_name` | `Order.recipient` | **필수, null 불가** |
| 수령자 폰 | `recv_mobile` | `Order.phone` | 선택, null 가능 |
| 수령자 주소 | `recv_address` | `Order.address` | 선택, null 가능 |

### B. 송장 관리

- `set_trans_no`: 송장번호 + 택배사(`trans_corp`) 필수 입력.
- 송장 조회는 별도 분리 예정 (현재 미사용).

### C. 재고 동기화

- `get_stock_info` 응답: 상품 ID별 창고 맵 구조.
  ```json
  {
    "22197": {
      "stock": {
        "warehouse_1": { "stock": 100 },
        "warehouse_2": { "stock": 50 }
      }
    }
  }
  ```
- 총 재고 계산: 창고별 `stock` 합산.

### D. 패킹/입출고

- **Onedas API** (패킹 작업):
  - `picking_orders`: 작업일(`work_date`), 차수(`no`), 생성일(`crdate`), 상태(`status`).
  - `packing_orders`: 각 picking order 내 패킹 세부사항.
  - **주의**: 응답 구조는 공식 문서 참조. 추론 금지.

- **Sheet API** (입출고):
  - `add_sheet`: sheet_type enum 필수 (`STOCK_IN_SHEET`, `STOCK_OUT_SHEET` 등).
  - `add_sheet_items`: 각 항목별 product_id|link_id + qty + 선택 메타데이터.

### E. 권한 격리

- ONEWMS API는 **MASTER 역할 전용** (운영 대시보드).
- SUB_MASTER, SELLER는 접근 불가.

---

## 4️⃣ P2 Gaps (향후 개선 계획)

| # | 기능 | 상태 | 예상 우선순위 |
|---|------|------|-------------|
| 1 | 상품 자동 등록 (add_product 자동화) | 미계획 | P2 |
| 2 | 입출고 전표 통합 UI | 미계획 | P2 |
| 3 | 패킹 작업 모니터링 대시보드 | 미계획 | P2 |
| 4 | 송장 추적(real-time) | 미계획 | P2 |
| 5 | 다중 창고 재고 분산 로직 | 미계획 | P2 |
| 6 | 반품/교환 흐름 자동화 | 미계획 | P2 |
| 7 | API 동기화 에러 자동 복구 | 구현 중 | P1.5 |
| 8 | 재고 충돌 해결 UI (현재 관리자만) | 구현 중 | P1.5 |

---

## 5️⃣ Commit History

### P0 Hotfix (2026-05-09 ~ 2026-05-12)

**목표**: 운영 환경에서 발주 동기화 100% 거부 문제 해결.

| Commit | 내용 | 상태 |
|--------|------|------|
| `85df3cb` | ONEWMS API 호출 패턴 (set_orders + get_order_info) | ✅ |
| `d2ed466` | shop_id 부트스트랩 스크립트 + 환경변수 | ✅ |
| `0dd4460` | ONEWMS API 필드명 재정의 (P0+P1) | ✅ |
| `a9e66f5` | orderSync/deliverySync 매핑 로직 + null guard | ✅ |

**주요 변경**:
- CreateOrderRequest: shop_id + collect_date + rows[] 스키마 정의.
- CreateOrderRow: 각 상품별 1 row (이전: 전체 1 row 패턴).
- null guard: recipient, phone, address 안전한 처리.
- shop_id 검증: assertShopId() 함수로 명시적 에러.

### P1 Cleanup (2026-05-13 ~ 2026-05-14)

**목표**: 신규 P1 API 타입 정의 및 필드명 통일.

| Commit | 내용 | 상태 |
|--------|------|------|
| `6b8ef11` | ONEWMS P1 API 필드명 일괄 정리 (add_product / add_sheet / get_onedas_*) | ✅ |

**주요 변경**:
- SetTransportNumberRequest: trans_corp 필수화.
- AddProductRequest: name 필수, 12개 선택 필드 추가.
- SheetInfo: 상태 필드 강화 (sheet_seq, status, warehouse_seq, created_at).
- AddSheetRequest: sheet_type enum, products 제거 (별도 add_sheet_items).
- OnedasPackingInfo/DetailInfo: 공식 문서 기준 필드명 재정의.

### A+B+C 최종 마무리 (2026-05-15)

**목표**: 타입 갭 수정 + 학습 문서화 + 종합 가이드.

| Commit | 내용 | 상태 |
|--------|------|------|
| (예정) | ONEWMS 타입 갭 3개 수정 + CLAUDE.md 학습 #11 추가 | ✅ |

**주요 변경**:
- OnedasPackingInfo: picking_order_no 제거, work_date/no 필수화.
- OnedasPackingDetailInfo: picking_orders → data wrapper 변경.
- AddSheetItemsRequest: supply_code 제거, product_id|link_id + qty 스키마.
- CLAUDE.md: 학습 #11 "외부 API 문서 우선" 원칙 추가.
- docs/onewms/SUMMARY.md: 이 파일 (종합 가이드).

---

## 📚 Related Files

**핵심 구현**:
- `lib/onewms/` — API 클라이언트 및 타입 정의
- `lib/services/onewms/` — 동기화 비즈니스 로직
- `scripts/onewms-bootstrap-shop.ts` — 부트스트랩 유틸

**문서**:
- `docs/onewms/01-*.md` — ONEWMS API 공식 문서 사본
- `docs/onewms/SUMMARY.md` — 이 파일
- `CLAUDE.md` — 프로젝트 학습 기록

**DB 스키마**:
- `prisma/schema.prisma` — OnewmsOrderMapping, OnewmsStockSync, OnewmsDeliveryLog

---

## 🎯 Quick Links

**ONEWMS 공식 API 문서**:
- [API 명세서](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f)

**라이브 커머스 프로젝트**:
- [GitHub](https://github.com/your-org/live-commerce)
- [운영 대시보드](https://www.supermujin.ai/dashboard/onewms)

---

_작성: 2026-05-15 · 최종 검증: 2026-05-15_
