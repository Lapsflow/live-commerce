# ONEWMS API: get_product_info (상품조회)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=c5cc0931bfc9476ab1a0cb4912b3cef2&pm=s)

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `get_product_info` |
| 타입 | 상품 |
| 설명 | 상품정보를 조회 |

## 파라미터
| 파라미터 | 항목 | 형식 | 기본값 | 비고 |
|---|---|---|---|---|
| `product_id` | 상품코드 | | | |
| `link_id` | 연동코드 | | | |
| `supply_code` | 공급처코드 | | | API 기타정보조회에서 확인 |
| `barcode` | 바코드 | | | |
| `date_type` | 조회일시타입 | | | `reg_date`(등록일시) / `last_update_date`(최종수정일시) |
| `start_date` | 검색시작일시 | YYYY-MM-DD (HH:MM:SS) | 3개월 전일시 | 시간 생략 가능 |
| `end_date` | 검색종료일시 | YYYY-MM-DD (HH:MM:SS) | 조회시점 | 시간 생략 가능 |
| `page` | 페이지 | int | 1 | |
| `limit` | 검색수 | 10/30/50/100/300 | 10 | |

## 응답
| 필드 | 항목 | 비고 |
|---|---|---|
| `error` | 에러코드 | |
| `msg` | 메시지 | |
| `total` | 총 상품수 | |
| `page` | 페이지 | |
| `limit` | 조회수 | |
| `data` | 상품정보 | array |

## 슈퍼무진 구현
`client.ts` — `getProductList(params)` (호출처 없음 — 미활용)
