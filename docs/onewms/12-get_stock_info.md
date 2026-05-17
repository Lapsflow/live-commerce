# ONEWMS API: get_stock_info (재고조회)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=b5238830777d43f5bfec1f3e37ab7330&pm=s)

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `get_stock_info` |
| 타입 | 재고 |
| 설명 | 현재고정보를 조회 |

## 파라미터
| 파라미터 | 항목 | 필수 | 값 | 기본값 | 비고 |
|---|---|---|---|---|---|
| `type` | 검색타입 | **O** | `product_id` 상품코드<br>`link_id` 연동코드<br>`barcode` 바코드<br>`supply_code` 공급처코드 | | |
| `ids` | 검색값 | **O** | 콤마 구분 복수 가능 | | |
| `warehouse_seq` | 창고번호 | X | int | 1 (기본창고) | 기타조회에서 확인 |
| `stock_type` | 재고타입 | X | int | 0 (정상) | 기타조회에서 확인 |
| `include_ready_trans` | 접수/송장재고 포함 | X | 0/1 | 0 (미포함) | |

## 응답
| 필드 | 항목 | 비고 |
|---|---|---|
| `error` | 에러코드 | |
| `msg` | 메시지 | |
| `data` | 재고 정보 | array |

## 슈퍼무진 구현
- `client.ts` — `getStockInfo(params)`
- 호출처: `lib/services/onewms/stockSync.ts` (1분 cron + 발주등록 시점 즉시 sync)
- ⚠️ `ids` 는 콤마 구분 복수 가능 → batch 호출로 사용 중 (확인 OK)

## ⚠️ 운영 메모
- 우리는 `type=product_id` 기준으로 동기화 — `link_id` 미사용
- ONEWMS 측 product_id 와 우리 `Product.onewmsProductId` 매핑이 깨지면 sync 누락 발생
- `include_ready_trans=0` 기본값 사용 중 — 즉시 가용재고만 노출 (정책 일치)
