# ONEWMS API: get_code_match (매칭정보조회)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=9c562c5aa7fe4cc68f5b7191828e5992&pm=s)

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `get_code_match` |
| 타입 | 상품 |
| 설명 | 매칭정보를 조회 (판매처상품 ↔ 사내상품) |

## 파라미터
| 파라미터 | 항목 | 형식 | 기본값 | 비고 |
|---|---|---|---|---|
| `start_date` | 검색시작일시 | YYYY-MM-DD (HH:MM:SS) | 1개월 전일시 | 시간 생략 가능 |
| `end_date` | 검색종료일시 | YYYY-MM-DD (HH:MM:SS) | 조회시점 | 시간 생략 가능 |
| `shop_id` | 판매처코드 | | | 기타조회에서 확인 |
| `product_id` | 상품코드 | | | 사내상품 ID |
| `shop_product_id` | 판매처상품코드 | | | |
| `shop_product_name` | 판매처상품명 | | | |
| `shop_options` | 판매처옵션명 | | | |
| `page` | 페이지 | int | 1 | |
| `limit` | 검색수 | 10/30/50/100/300 | 10 | |

## 응답
| 필드 | 항목 | 비고 |
|---|---|---|
| `error` | 에러코드 | |
| `msg` | 메시지 | |
| `total` | 총 매칭수 | |
| `page` | 페이지 | |
| `limit` | 조회수 | |
| `data` | 매칭정보 | array |

## 슈퍼무진 구현
`client.ts` — `getCodeMatch(params)` (호출처 없음 — 미활용)

## 활용 시나리오
- 우리 셀러가 등록한 판매처 상품이 ONEWMS 사내상품과 매칭되어 있는지 사전 확인
- 매칭 누락 발견 → 알림/수동 매칭 가이드
