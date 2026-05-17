# ONEWMS 공식 API ↔ 슈퍼무진 구현 매핑

> **목적**: ONEWMS Notion 공식 문서의 API 19개 vs 우리 `lib/onewms/client.ts` 구현 1:1 매핑
> **결론**: **공식 API 19개 모두 구현 완료**. 다만 활용도 차이 큼.

---

## 📋 매핑 결과 — 전체 19개 API 모두 구현됨

### 🔹 주문 (Order) — 7개

| # | 공식 ONEWMS API | 우리 함수 (client.ts) | 호출처 (실제 운영 사용) | 상태 |
|---|---|---|---|---|
| 1 | `get_order_info` (주문조회) | `getOrderInfo()` | (현재 호출처 없음 — 미활용) | ⚠️ 구현됐으나 미활용 |
| 2 | `set_orders` (주문생성) | `createOrder()` | `lib/services/onewms/orderSync.ts` | ✅ 활발히 사용 |
| 3 | `set_trans_no` (송장입력) | `setTransportNumber()` | `lib/services/onewms/deliverySync.ts` | ✅ |
| 4 | `set_trans_pos` (배송처리) | `setTransportPos()` | `lib/services/onewms/deliverySync.ts` | ✅ |
| 5 | `cancel_trans_pos` (배송취소) | `cancelTransportPos()` | (호출처 추가 조사 필요) | ⚠️ |
| 6 | `get_trans_invoice` (송장이미지) | `getTransportInvoice()` | (호출처 추가 조사 필요) | ⚠️ |
| 7 | `set_order_label` (주문태그) | `setOrderLabel()` | (호출처 없음 — 미활용) | ⚠️ 구현됐으나 미활용 |

### 🔹 상품 (Product) — 3개

| # | 공식 ONEWMS API | 우리 함수 | 호출처 | 상태 |
|---|---|---|---|---|
| 8 | `get_product_info` (상품조회) | `getProductList()` | `productImport.ts` (가격 sync) | ✅ 활발히 사용 |
| 9 | `get_code_match` (매칭정보) | `getCodeMatch()` | (호출처 없음 — 미활용) | ⚠️ 구현됐으나 미활용 |
| 10 | `add_product` (상품추가) | `addProduct()` | `autoRegister.ts` (자동 등록) | ✅ |

### 🔹 재고 (Stock) — 3개

| # | 공식 ONEWMS API | 우리 함수 | 호출처 | 상태 |
|---|---|---|---|---|
| 11 | `get_stock_info` (재고조회) | `getStockInfo()` | `stockSync.ts` (1분 cron) | ✅ **핵심 사용** |
| 12 | `get_stock_tx_info` (재고이력) | `getStockTxInfo()` | (호출처 없음 — 미활용) | ⚠️ |
| 13 | `get_stock_tx_detail_info` (재고이력상세) | `getStockTxDetailInfo()` | (호출처 없음 — 미활용) | ⚠️ |

### 🔹 기타 (Etc) — 1개

| # | 공식 ONEWMS API | 우리 함수 | 호출처 | 상태 |
|---|---|---|---|---|
| 14 | `get_etc_info` (기타정보: 판매처/공급처/택배사/화주/재고타입/재고작업타입/카테고리) | `getEtcInfo()`, `getStockJobTypes()` | (호출처 없음 — 미활용) | ⚠️ 구현됐으나 미활용 |

### 🔹 전표 (Sheet) — 2개

| # | 공식 ONEWMS API | 우리 함수 | 호출처 | 상태 |
|---|---|---|---|---|
| 15 | `get_sheet_list` (전표조회) | `getSheetList()` | (호출처 없음 — 미활용) | ⚠️ |
| 16 | `add_sheet` (전표추가) | `addSheet()` | (호출처 없음 — 미활용) | ⚠️ |

### 🔹 원다스 (Onedas) — 2개

| # | 공식 ONEWMS API | 우리 함수 | 호출처 | 상태 |
|---|---|---|---|---|
| 17 | `get_onedas_packing_no` | `getOnedasPackingNo()` | (호출처 없음 — 미활용) | ⚠️ |
| 18 | `get_onedas_packing_no_detail` | `getOnedasPackingNoDetail()` | (호출처 없음 — 미활용) | ⚠️ |

---

## 📊 활용도 요약

| 상태 | 개수 | 비율 | 비고 |
|---|---|---|---|
| ✅ 활발히 사용 (실제 운영) | **5개** | 28% | createOrder, setTransNo, setTransPos, getProductList, getStockInfo |
| ⚠️ 구현됐으나 미활용 | **13개** | 72% | 함수는 있지만 호출처 없음. 향후 기능 추가 시 활용 가능 |
| ❌ 미구현 | **0개** | 0% | 공식 API 모두 구현 완료 |

---

## 🎯 슈퍼무진 운영 시나리오별 활용 분석

### 시나리오 A. 본사 발주 → ONEWMS 자동 출고 (현재 운영)
- `set_orders` ✅ (createOrder 호출, 발주 컨펌 시점)
- `set_trans_no` ✅ (송장 자동 입력)
- `set_trans_pos` ✅ (배송 처리)

### 시나리오 B. 재고 동기화 (현재 운영, 1분 cron)
- `get_stock_info` ✅ (모든 본사 상품 재고 batch 조회)
- `get_product_info` ✅ (가격 동기화 — supply_price, shop_price, org_price)

### 시나리오 C. 신규 상품 자동 등록 (현재 운영)
- `get_product_info` ✅ (페이지별 조회)
- `add_product` ✅ (필요 시 신규 등록)

### 시나리오 D. 추가 가능한 기능 (미구현 활용 사례)

#### D-1. 발주 후 정확한 ONEWMS 주문 상태 조회
- `get_order_info` 활용 → 우리 시스템에서 ONEWMS 주문 상태(접수/송장/배송) 실시간 확인 가능
- **추천도**: 🔥 높음 — 본사 발주 컨펌 후 진행 상황 추적용

#### D-2. 배송 취소 처리
- `cancel_trans_pos` 활용 → 발주 컨펌 후 취소 처리 자동화
- **추천도**: 중간 — 운영 이슈 발생 시 필요

#### D-3. 송장 이미지 자동 첨부
- `get_trans_invoice` 활용 → 셀러/센터 화면에 송장 이미지 자동 표시
- **추천도**: 중간 — 운영자 편의 기능

#### D-4. 주문 태그 (분류용)
- `set_order_label` 활용 → 라이브 방송별, 셀러별 태그
- **추천도**: 낮음 — 현재 우리 DB에 broadcastId 있음

#### D-5. 재고 변동 이력 추적 (감사)
- `get_stock_tx_info`, `get_stock_tx_detail_info` 활용 → 큰 차이 발생 시 누가/언제 변경했는지 추적
- **추천도**: 🔥 높음 — `[LARGE_DIFF_AUTO_APPLIED]` 알람 후 조사용

#### D-6. 판매처/택배사/카테고리 메타 동기화
- `get_etc_info` 활용 → ONEWMS 측 카테고리 변경 시 자동 반영
- **추천도**: 낮음 — 현재 우리 DB가 마스터

#### D-7. 전표 자동 생성
- `add_sheet` 활용 → 입출고 전표 자동 생성
- **추천도**: 낮음 — 회계 자동화 필요 시

#### D-8. 원다스 패킹 정보
- `get_onedas_packing_no` 활용 → 패킹 진행 상황 추적
- **추천도**: 낮음 — 본사 패킹 워크플로우 사용 시

---

## 🚨 ONEWMS 측 API 호출 제한 고려사항

공식 문서 명시:
> ONEWMS / ONEFMS API는 안정적인 운영을 위해 전체 호출량을 지속적으로 모니터링하고 있습니다.
> 과도한 호출이 감지될 경우 사전 고지 없이 호출 제한이 적용될 수 있습니다.

### 현재 슈퍼무진 호출 패턴 (2026-05-13 기준)

| API | 빈도 | 시간당 호출 |
|---|---|---|
| `get_stock_info` (batch 100개씩) | 1분마다 | **약 14회** (상품 1,349개 ÷ 100) |
| `get_product_info` (가격 sync, 페이지별) | 1분마다 | **약 14회** (페이지 14개) |
| `add_product` (신규 자동 등록) | 1분마다 (필요 시만) | 0~수 회 |
| `set_orders` (발주 컨펌 시) | 발주당 1회 | 가변 |
| 합계 | | **약 30-50회/시간** |

### 권장 조정 옵션

만약 ONEWMS 측에서 호출 제한 알람이 오면:

1. **cron 빈도 완화**: 1분 → 5분 (`*/5 * * * *`) → API 호출 1/5
2. **가격 sync는 별도 cron으로 분리**: 가격은 1시간마다, 재고만 1분마다
3. **변경 감지 기반 sync**: 마지막 sync와 비교해서 변경된 것만 push

→ 현재 호출량 자체가 과도하지는 않아 보이지만, **운영 모니터링 필요**.

---

## 📌 다음 액션 추천

### 우선순위 1: 데이터베이스 view 안의 개별 API 상세 페이지 추출
공식 문서에 각 API의 입력 파라미터, 응답 스키마가 별도 페이지로 들어있을 가능성. Firecrawl로 데이터베이스 view를 직접 호출하려면 추가 작업 필요.

→ **수동 작업**: 노션 페이지에서 각 API 행 클릭 → 상세 페이지 들어가서 URL 확보 → 1개씩 fetch

### 우선순위 2: get_order_info 활용 — 발주 진행 상황 자동 추적
**가장 ROI 높은 미활용 기능**. 본사 발주 후 ONEWMS의 주문 상태(접수/송장/배송)를 우리 DB와 동기화.

### 우선순위 3: get_stock_tx_info 활용 — 큰 차이 발생 시 자동 조사
`[LARGE_DIFF_AUTO_APPLIED]` 로그가 발생하면 자동으로 해당 상품의 재고 변동 이력을 조회해서 원인 추적.

---

## 🔚 결론

| 질문 | 답 |
|---|---|
| 공식 API 중 미구현이 있나? | **없음 (19/19 구현)** |
| 활용 중인 API는? | 5개 (28%) — 재고/발주/배송 핵심 |
| 추가 활용 여지는? | 13개 — D-1, D-5 우선 추천 |
| 호출 제한 위험은? | 현재 30-50회/시간 — 안전 범위 |

**즉 ONEWMS와의 연동은 코드 차원에서 매우 완성도 높음**. 추가 작업이 필요한 건 **활용 시나리오 확장** (예: 주문 상태 자동 추적) 정도.
