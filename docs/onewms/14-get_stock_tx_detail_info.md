# ONEWMS API: get_stock_tx_detail_info (재고이력상세조회)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=13b8cd21e08a4ee883f028072ad9b051&pm=s)

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `get_stock_tx_detail_info` |
| 타입 | 재고 |
| 설명 | 재고 변동 이력(개별 트랜잭션)을 조회 |

## 파라미터
| 파라미터 | 항목 | 필수 | 형식 | 기본값 | 비고 |
|---|---|---|---|---|---|
| `start_date` | 조회시작일 | **O** | YYYY-MM-DD (HH:MM:SS) | | 시간 생략 가능 |
| `end_date` | 조회종료일 | **O** | YYYY-MM-DD (HH:MM:SS) | | 시간 생략 가능 |
| `product_id` | 상품코드 | X | | | |
| `warehouse_seq` | 창고번호 | X | int | 1 (기본창고) | 기타조회에서 확인 |
| `stock_type` | 재고타입 | X | int | 0 (정상) | 기타조회에서 확인 |
| `job` | 작업 | X | | 공백 (전체) | `in`/`out`/`trans`/`shiftin`/`shiftout`/`arrange` |
| `job_type` | 작업타입 | X | int | 0 (기본작업) | 기타조회에서 확인 |
| `page` | 페이지 | X | int | 1 | |
| `limit` | 조회수 | X | int | 10 | |

## 응답
| 필드 | 항목 | 비고 |
|---|---|---|
| `error` | 에러코드 | |
| `msg` | 메시지 | |
| `data` | 재고이력상세 | array (개별 건별) |

## get_stock_tx_info 와 차이
- `get_stock_tx_info` = 변동량 **집계** (일별/기간별 합계)
- `get_stock_tx_detail_info` = 개별 **트랜잭션** (어떤 주문/작업에 의해 변동되었는지)

## 슈퍼무진 구현
`client.ts` — `getStockTxDetailInfo(params)` (호출처 없음 — 미활용)

## 활용 시나리오
- 특정 시점에 재고가 줄어든 원인 추적 (특정 송장? 조정?)
- 분쟁/이상치 발생 시 reconciliation
