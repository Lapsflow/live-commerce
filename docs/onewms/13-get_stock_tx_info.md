# ONEWMS API: get_stock_tx_info (재고이력조회)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=6f56596969ca45b48fe9069e32dcf5a2&pm=s)

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `get_stock_tx_info` |
| 타입 | 재고 |
| 설명 | 재고변동량을 조회 |

## 파라미터
| 파라미터 | 항목 | 필수 | 형식 | 기본값 | 비고 |
|---|---|---|---|---|---|
| `start_date` | 조회시작일 | **O** | YYYY-MM-DD | | 일자만 가능 |
| `end_date` | 조회종료일 | **O** | YYYY-MM-DD | | 일자만 가능 |
| `product_id` | 상품코드 | X | | | |
| `warehouse_seq` | 창고번호 | X | int | 1 (기본창고) | 기타조회에서 확인 |
| `stock_type` | 재고타입 | X | int | 0 (정상) | 기타조회에서 확인 |
| `job` | 작업 | X | | 공백 (전체) | `in` 입고, `out` 출고, `trans` 배송, `shiftin` 이동입고, `shiftout` 이동출고, `arrange` 조정 |
| `job_type` | 작업타입 | X | int | 0 (기본작업) | 기타조회에서 확인 |
| `page` | 페이지 | X | int | 1 | |
| `limit` | 조회수 | X | int | 10 | |

## 응답
| 필드 | 항목 | 비고 |
|---|---|---|
| `error` | 에러코드 | |
| `msg` | 메시지 | |
| `data` | 데이터 | array (변동량 집계) |

## 슈퍼무진 구현
`client.ts` — `getStockTxInfo(params)` (호출처 없음 — 미활용)

## 활용 시나리오
- 일별/기간 재고 변동량을 한 번에 받아 대시보드/리포트에 사용
- 발주 컨펌 후 실제 출고가 일어났는지 검증 (`job=out`)
