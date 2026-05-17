# ONEWMS 공식 문서 vs 우리 구현 — 갭 분석

> 작성일: 2026-05-17
> 분석 대상: `lib/onewms/client.ts`, `lib/onewms/types.ts`, `lib/services/onewms/*`
> 비교 기준: `docs/onewms/01~16-*.md` (공식 Notion 문서 추출본)

## 결론 한 줄
**우리 구현은 18/19 함수가 호출은 되지만, 운영에 쓰이는 `set_orders` / `set_trans_no` / `set_trans_pos` / `cancel_trans_pos` / `set_order_label` / `add_product` / `add_sheet` / `get_onedas_*` 8개가 필드명 자체가 틀려서 호출 시 ONEWMS 측이 100% 거부함.**

운영에서 실제로 호출되는 것은 `get_stock_info` (정상), `set_orders` (필드 불일치 — **즉시 핫픽스 필요**), `set_trans_no` (필드 불일치).

---

## 🔴 P0 — 즉시 핫픽스 (운영 영향)

### 1. `set_orders` (createOrder)
**호출처**: `lib/services/onewms/orderSync.ts:86-96` (발주 컨펌 시)

| 항목 | 우리 코드 | 공식 사양 | 영향 |
|---|---|---|---|
| 주문번호 필드 | `order_no` | `order_id` | 주문 등록 실패 |
| 수령자명 | `recipient_name` | `recv_name` (필수) | 거부 |
| 수령자전화 | `recipient_phone` | `recv_mobile` (또는 `recv_tel`) | 무시됨 |
| 수령자주소 | `recipient_address` | `recv_address` | 무시됨 |
| 상품 구조 | `products: [{product_code, quantity}]` (top-level 배열) | **JSON 배열** = 주문 1건당 row 1개 (`shop_product_id`, `qty` 포함) | 구조 자체가 다름 |
| **`shop_id`** | **없음** | **필수** (query param, 사용자정의 판매처 전용) | 거부 |
| 발주일 | `order_date` (per-row) | `collect_date` (query param) | 위치 다름 |

**필요 매핑**:
- `Order.recipient` → `recv_name`
- `Order.phone` → `recv_mobile`
- `Order.address` → `recv_address`
- `Order.id` 또는 `Order.orderNo` → `order_id`
- 각 `OrderItem` → row 1개 (`shop_product_id = product.onewmsCode`, `qty = quantity`, `recv_*` 정보 모두 복제)
- `shop_id` → 환경변수 `ONEWMS_SHOP_ID` 신설 필요 (먼저 `get_etc_info?search_type=shop` 으로 우리 판매처 코드 확인)

### 2. `set_trans_no` (setTransportNumber)
**호출처**: `lib/services/onewms/deliverySync.ts` (?)

| 항목 | 우리 코드 | 공식 사양 | 영향 |
|---|---|---|---|
| 식별자 | `order_no` | `seq` (관리번호, get_order_info 응답의 `seq`) | 송장 입력 실패 |
| 택배사 | (없음) | `trans_corp` (필수) | 거부 |
| 송장번호 | `trans_no` | `trans_no` ✅ | OK |

### 3. `get_order_info` 호출에서 `order_no` 사용
**호출처**: `deliverySync.ts:92`
- 공식 파라미터에는 `order_no` 가 없음 (가능: `order_id`, `trans_no`, `seq`)
- 결과: 필터 미적용 → 30일 전체 주문에서 첫 번째만 가져옴 (조용히 잘못된 데이터)

---

## 🟡 P1 — 호출처 없지만 미래 사용 시 깨짐

### 4. `set_trans_pos` (setTransportPos)
| 우리 코드 | 공식 |
|---|---|
| `order_no` | `trans_no` (필수) |

### 5. `cancel_trans_pos` (cancelTransportPos)
| 우리 코드 | 공식 |
|---|---|
| `order_no` | `trans_no` (필수) |

### 6. `set_order_label` (setOrderLabel)
| 우리 코드 | 공식 |
|---|---|
| `order_no`, `label` | `seq`, `label_name` |

### 7. `add_product` (addProduct)
| 우리 코드 | 공식 |
|---|---|
| `product_code`, `product_name` | `name` (필수). `product_code` 는 응답으로 반환됨 |

### 8. `get_onedas_packing_no` (getOnedasPackingNo)
| 우리 코드 | 공식 |
|---|---|
| `getOnedasPackingNo(orderNo)` → `order_no` 전달 | `work_date` (YYYY-MM-DD, 필수) |

### 9. `get_onedas_packing_no_detail` (getOnedasPackingNoDetail)
| 우리 코드 | 공식 |
|---|---|
| `getOnedasPackingNoDetail(packingNo)` → `packing_no` 전달 | JSON body: `{ "picking_list": [{ work_date, no, no_sub }] }` |

### 10. `add_sheet` (addSheet)
| 우리 코드 | 공식 |
|---|---|
| `sheet_type`, `sheet_date`, `products` | `sheet_type`, `sheet_name`, `warehouse_seq`, `stock_type_seq`, `job_type_seq` (상품은 `add_sheet_items` 로 별도) |

### 11. `get_sheet_list` (getSheetList)
| 우리 코드 | 공식 |
|---|---|
| `start_date`, `end_date` 만 | `sheet_type` + `date_type` (필수) + `start_date` + `end_date` |

---

## 🟢 P2 — 정상

### 12. `get_stock_info` ✅
- 우리: `type`, `ids`, `warehouse_seq`, `stock_type`, `include_ready_trans`
- 공식: 동일
- 호출처: `stockSync.ts` 정상 동작 중

### 13. `get_etc_info` ✅
- `search_type` 파라미터 일치
- 단, `job_type` 분기 처리 OK

### 14. `get_product_info`, `get_code_match`, `get_stock_tx_info`, `get_stock_tx_detail_info`
- 호출처 없지만 파라미터는 충돌 없음

---

## 핫픽스 영향 범위

### 코드 수정 파일 (P0 만)
1. `lib/onewms/types.ts` — `CreateOrderRequest`, `SetTransportNumberRequest` 타입 재정의
2. `lib/onewms/client.ts:185~` `getOrderInfo` 파라미터에서 `order_no` 제거
3. `lib/services/onewms/orderSync.ts:86-96` — `CreateOrderRequest` 빌드 로직 전면 재작성
4. `lib/services/onewms/deliverySync.ts:92` — `order_no` → `order_id` 또는 `seq`
5. `.env` / `lib/onewms/config.ts` — `ONEWMS_SHOP_ID` 추가

### 검증
- `pnpm tsc --noEmit && pnpm lint && pnpm build`
- Playwright 발주 컨펌 시나리오에서 ONEWMS sync 성공 확인
- `OnewmsOrderMapping.errorMessage` 가 더 이상 "Invalid order_no" 류 에러 안 뜨는지

### 운영 데이터 cleanup
- 기존 `failed` 상태 매핑 13,239건 (?) 의 `errorMessage` 확인 → 필드명 에러였다면 핫픽스 후 재시도로 자동 해소

---

## 권장 작업 순서
1. ✅ **타입 재정의** (`types.ts`) — 신/구 호환을 위해 일단 모든 필드를 optional 로
2. ✅ **`orderSync.ts` 매핑 재작성** — Order → set_orders JSON 변환
3. ✅ **`shop_id` 환경변수 추가** — `.env.local` 에 우리 판매처 코드
4. ✅ **`deliverySync.ts` `order_no` → `order_id` 수정**
5. ⏸ 운영 한 번 sync 돌려서 성공 확인 (실제 ONEWMS 토큰 필요 → 사용자가 진행)
6. ⏸ 성공 확인 후 P1 (송장/태그/제품/시트/원다스) 일괄 정리
