# ONEWMS API: get_order_info (주문조회)

> **출처**: [Notion 공식 문서](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=f5c73c080f3c46ed8d2f4303ef396e77&pm=s)
> **추출일**: 2026-05-13 (Firecrawl 자동 추출)

## 기본 정보

| 항목 | 값 |
|---|---|
| 함수명 (action) | `get_order_info` |
| 타입 | 주문 |
| 설명 | 주문정보를 조회 |

## 파라미터

| parameter | 항목 | 필수 | 형식 | 기본값 | 비고 |
|---|---|---|---|---|---|
| `date_type` | 조회일시타입 | **O** | `collect_date`: 발주일시 / `order_date`: 주문일시 / `ready_date`: 접수일시 / `trans_date`: 송장일시 / `trans_date_pos`: 배송일시 / `cancel_date`: 취소일시 / `change_date`: 교환일시 / `cs_date`: CS입력일시 | | |
| `start_date` | 검색시작일시 | **O** | `YYYY-MM-DD (HH:MM:SS)` | 1개월 전일시 | 시간 생략 가능 |
| `end_date` | 검색종료일시 | **O** | `YYYY-MM-DD (HH:MM:SS)` | 조회시점 | 시간 생략 가능 |
| `status` | 주문상태 | | | 전체 | 부록 주문상태 참고 |
| `order_cs` | CS상태 | | | 전체 | 부록 CS상태 참고 |
| `hold` | 보류상태 | | `0`: 정상 / `1`: 보류(전체) | 전체 | 부록 보류상태 참고 |
| `order_id` | 주문번호 | | | | |
| `trans_no` | 송장번호 | | | | |
| `product_id` | 상품코드 | | | | |
| `seq` | 관리번호 | | | | |
| `shop_id` | 판매처코드 | | | | API 항목 기타조회에서 확인 |
| `sub_domain_seq` | 화주번호 | | | | API 항목 기타조회에서 확인 |
| `product_tag` | 상품태그 | | 26시즌, 냉동, 식품 등 | | `,`로 구분하여 n개 입력 |
| `product_tag_match` | 상품태그 검색옵션 | | `1`: 전체포함 / `2`: 부분포함 / `3`: 일치 | 1 | product_tag 값이 있을때 유효 |
| `product_tag_exclude` | 상품태그 제외 | | `0`: 태그검색 / `1`: 태그제외 | 0 | product_tag 값이 있을때 유효, product_tag_match 조건에 맞춰서 제외 |
| `order_label` | 주문태그 | | 주문태그 필터 (콤마 구분, 예: 긴급,VIP) | | |
| `order_label_match` | 주문태그옵션 | | `1`: 전체포함 (지정한 태그를 모두 가진 주문) / `2`: 부분포함 (지정한 태그 중 하나라도 가진 주문) / `3`: 정확일치 (지정한 태그만 가진 주문) | 1 | |
| `order_label_exclude` | 주문태그 제외 | | (콤마 구분, 예: 보류,배송불가) | | |
| `order_label_exclude_match` | 주문태그 제외옵션 | | `1`: 전체제외 (지정한 태그를 모두 가진 주문만 제외) / `2`: 부분제외 (지정한 태그 중 하나라도 가진 주문 제외) / `3`: 정확제외 (지정한 태그만 가진 주문만 제외) | 2 | |
| `packing_type` | 합포 타입 | | `single_qty`: 수량 1개 / `multi_qty`: 수량 2개 이상 (상품 무관) / `single_product`: 상품 1종류 (수량 무관) / `multi_product`: 상품 2종류 이상 / `single_product_multi_qty`: 상품 1종류 + 수량 2개 이상 | | |
| `limit` | 검색수 | | 10, 30, 50, 100, 300, 500, 1000 | 10 | |

## 응답

| field | 항목 | 비고 |
|---|---|---|
| `error` | 에러코드 | |
| `msg` | 메시지 | |
| `total` | 전체 주문건수 | |
| `pack_cnt` | 전체 합포단위수 | |
| `product_sum` | 전체 상품수량합 | |
| `page` | 페이지 | |
| `limit` | 조회수 | |
| `data` | 주문정보 | |

## 슈퍼무진 구현

`lib/onewms/client.ts:185` — `async getOrderInfo(params)`
- 현재 호출처: **없음** (구현됐으나 미활용)
- 추천 활용처: 본사 발주 컨펌 후 ONEWMS 주문 상태 자동 추적
