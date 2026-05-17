# ONEWMS / ONEFMS API — 공식 문서 인덱스

> 원본: [Notion ONEWMS-FMS-API 명세서](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f)
> Fetch 완료일: 2026-05-17
> 본 디렉토리의 모든 md 파일은 공식 Notion 문서를 그대로 추출한 것이며, "슈퍼무진 구현" 섹션은 우리 코드 매핑입니다.

## 공통 호출 사양
- URL: `https://api.onewms.co.kr/api.php`
- 메서드: GET / POST
- 응답: JSON
- 필수 파라미터: `partner_key`, `domain_key`, `action`

## API 목록 (16건 / 모두 fetch 완료)

| # | 함수명 | 타입 | 한글명 | 파일 |
|---|---|---|---|---|
| 1 | `get_order_info` | 주문 | 주문조회 | [01-get_order_info.md](./01-get_order_info.md) |
| 2 | `set_orders` | 주문 | 주문생성 | [02-set_orders.md](./02-set_orders.md) ⚠️ 핵심 |
| 3 | `set_trans_no` | 주문 | 송장입력 | [03-set_trans_no.md](./03-set_trans_no.md) |
| 4 | `set_trans_pos` | 주문 | 배송처리 | [04-set_trans_pos.md](./04-set_trans_pos.md) |
| 5 | `cancel_trans_pos` | 주문 | 배송취소 | [05-cancel_trans_pos.md](./05-cancel_trans_pos.md) |
| 6 | `get_trans_invoice` | 주문 | 송장이미지 | [06-get_trans_invoice.md](./06-get_trans_invoice.md) |
| 7 | `set_order_label` | 주문 | 주문태그 | [07-set_order_label.md](./07-set_order_label.md) |
| 8 | `get_product_info` | 상품 | 상품조회 | [08-get_product_info.md](./08-get_product_info.md) |
| 9 | `get_code_match` | 상품 | 매칭정보조회 | [09-get_code_match.md](./09-get_code_match.md) |
| 10 | `add_product` | 상품 | 상품추가 | [10-add_product.md](./10-add_product.md) |
| 11 | `get_etc_info` | 기타 | 기타정보조회 | [11-get_etc_info.md](./11-get_etc_info.md) ⚠️ 셋업 필수 |
| 12 | `get_stock_info` | 재고 | 재고조회 | [12-get_stock_info.md](./12-get_stock_info.md) ✅ 사용중 |
| 13 | `get_stock_tx_info` | 재고 | 재고이력조회 (집계) | [13-get_stock_tx_info.md](./13-get_stock_tx_info.md) |
| 14 | `get_stock_tx_detail_info` | 재고 | 재고이력상세조회 (트랜잭션) | [14-get_stock_tx_detail_info.md](./14-get_stock_tx_detail_info.md) |
| 15 | `get_sheet_list` / `add_sheet` / `update_sheet` / `get_sheet_detail` / `add_sheet_items` | 전표 | 전표관리 | [15-sheet_management.md](./15-sheet_management.md) |
| 16 | `get_onedas_packing_no` / `get_onedas_packing_no_detail` | 원다스 | 패킹/피킹 | [16-onedas_packing.md](./16-onedas_packing.md) |

## 부록 — 코드 마스터

### 주문상태 (status)
| 값 | 항목 |
|---|---|
| 1 | 접수 |
| 7 | 송장 |
| 8 | 배송 |

### CS상태 (order_cs)
| 값 | 항목 |
|---|---|
| 0 | 정상 |
| 1 | 배송전 전체 취소 |
| 2 | 배송전 부분 취소 |
| 3 | 배송후 전체 취소 |
| 4 | 배송후 부분 취소 |
| 5 | 배송전 전체 교환 |
| 6 | 배송전 부분 교환 |
| 7 | 배송후 전체 교환 |
| 8 | 배송후 부분 교환 |

### 보류상태 (hold)
| 값 | 항목 |
|---|---|
| 0 | 정상 |
| 1 | 일반 |
| 2 | 주소변경 |
| 3 | 교환 |
| 4 | 전체취소 |
| 5 | 부분취소 |
| 6 | 합포변경 |

## 슈퍼무진 구현 상태 요약

### ✅ 실제 사용 중
| 함수 | 호출처 | 비고 |
|---|---|---|
| `get_stock_info` | `lib/services/onewms/stockSync.ts` | 1분 cron + 발주등록 시점 즉시 sync. 콤마 batch OK |
| `set_orders` | `lib/services/onewms/orderSync.ts` | ⚠️ **필드명 불일치 — 핫픽스 필요** |
| `set_trans_no` | `lib/services/onewms/deliverySync.ts` | 필드명 확인 필요 |
| `set_trans_pos` | client.ts 노출됨 | 운영 호출처 확인 필요 |

### 🟡 구현됐지만 미사용 (`client.ts` 함수만 존재, 호출처 없음)
- `get_order_info`, `cancel_trans_pos`, `get_trans_invoice`, `set_order_label`
- `get_product_info`, `get_code_match`, `add_product`
- `get_etc_info`
- `get_stock_tx_info`, `get_stock_tx_detail_info`
- `get_sheet_list`, `add_sheet`
- `get_onedas_packing_no`, `get_onedas_packing_no_detail`

### ❌ 클라이언트 함수도 없음 (공식 API 존재 / 우리 미구현)
- `update_sheet`, `get_sheet_detail`, `add_sheet_items` (전표 관리 중간 단계)

---

## 다음 단계
1. `set_orders` 필드명 일괄 점검 (`order_id` / `recv_name` / `recv_mobile` / `recv_address` / `shop_id`)
2. `set_trans_no` 필드명 점검 (`seq` / `trans_corp` / `trans_no` / `trans_pos` / `type`)
3. `get_etc_info` 부트스트랩 — `shop_id` / `trans_corp` / `supply_code` 매핑 테이블 캐시
