# ONEWMS API: get_etc_info (기타정보조회)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=f4d504078f2c40389790adbec4ae5daf&pm=s)

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `get_etc_info` |
| 타입 | 판매처/공급처/택배사/화주/재고타입/재고작업타입/카테고리 |
| 설명 | 기타정보(코드 마스터)를 조회 |

## 파라미터
| 파라미터 | 항목 | 필수 | 값 | 비고 |
|---|---|---|---|---|
| `search_type` | 조회항목 | **O** | `supply` 공급처<br>`shop` 판매처<br>`trans` 택배사<br>`sub_domain` 화주<br>`warehouse` 창고<br>`stock_type` 재고유형<br>`job_type` 작업유형 | |

## 응답
| 필드 | 항목 | 비고 |
|---|---|---|
| `error` | 에러코드 | |
| `msg` | 메시지 | |
| `data` | 기타정보 | 조회항목에 따라 형식이 다름 |

## 슈퍼무진 구현
`client.ts` — `getEtcInfo(searchType)` (호출처 없음 — 미활용)

## ⚠️ 핵심 활용
- `set_orders` 의 `shop_id` 값을 알아내려면 먼저 `get_etc_info?search_type=shop` 호출 필요
- `set_trans_no` 의 `trans_corp` (택배사코드) 도 `search_type=trans` 로 조회
- `add_product` 의 `supply_code` 도 `search_type=supply` 로 조회

→ 운영 초기 1회 동기화 후 `code-mapping` 테이블에 캐시 권장
