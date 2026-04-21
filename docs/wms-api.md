# 원WMS API 연동 문서

> 테스트 일자: 2026-04-21 (3차 - Notion 명세 확인 반영)

---

## 기본 정보

| 항목 | 값 |
|------|-----|
| Base URL | `https://api.onewms.co.kr/api.php` |
| 방식 | POST (form data) |
| 인증 | `partner_key` + `domain_key` |
| 응답 | JSON (`error`: 0=성공, 1=실패) |

**인증 키는 `.env`에 보관:**
```
WMS_API_URL=https://api.onewms.co.kr/api.php
WMS_PARTNER_KEY=52bd55d7d931cb002c8569099fe9bda1
WMS_DOMAIN_KEY=eb731e190a51a6364185d7cf11641aa2
```

---

## API 목록 (전체)

| 분류 | action | 설명 | 테스트 결과 |
|------|--------|------|-------------|
| 상품 | `get_product_info` | 상품 목록 조회 | **성공** |
| 상품 | `get_code_match` | 매칭정보 조회 | 실패 (invalid action, 서버측 비활성화 추정) |
| 상품 | `add_product` | 상품 등록 | 미테스트 (쓰기) |
| 기타 | `get_etc_info` | 기타정보 조회 | **성공** (7/7 타입 모두 확인) |
| 재고 | `get_stock_info` | 현재고 조회 | **성공** (type+ids 파라미터 필수) |
| 재고 | `get_stock_tx_info` | 재고 변동량 조회 | **성공** |
| 재고 | `get_stock_tx_detail_info` | 재고 이력 상세 | **성공** |
| 주문 | `get_order_info` | 주문 조회 | **성공** (start_date/end_date 사용) |
| 주문 | `set_orders` | 주문 생성 | 미테스트 (쓰기) |
| 주문 | `set_trans_no` | 송장 입력 | 미테스트 (쓰기) |
| 주문 | `set_trans_pos` | 배송 처리 | 미테스트 (쓰기) |
| 주문 | `cancel_trans_pos` | 배송 취소 | 미테스트 (쓰기) |
| 주문 | `get_trans_invoice` | 송장 이미지 조회 | 미테스트 |
| 주문 | `set_order_label` | 주문 태그 지정 | 미테스트 (쓰기) |
| 전표 | `get_sheet_list` | 전표 조회 | 미테스트 |
| 전표 | `add_sheet` | 전표 등록 | 미테스트 (쓰기) |
| 원다스 | `get_onedas_packing_no` | 원다스 조회 | 미테스트 |
| 원다스 | `get_onedas_packing_no_detail` | 원다스 상세 | 미테스트 |

---

## 성공한 API 상세

### 1. get_product_info — 상품 목록 조회

**요청:**
```
action=get_product_info
page=1        (페이지 번호)
limit=10      (페이지당 건수)
```

**응답:**
```json
{
  "error": 0,
  "msg": "success",
  "total": 1032,
  "page": "1",
  "limit": 10,
  "data": [
    {
      "product_id": "22197",
      "name": "뉴트리너스 올바른 혈당 앤 유산균 (3g x 30포)",
      "supply_code": "20217",
      "brand": "",
      "origin": "",
      "weight": "0",
      "org_price": "4840",
      "shop_price": "9850",
      "supply_price": "6500",
      "barcode": "8809762411305",
      "enable_sale": "1",
      "use_temp_soldout": "0",
      "reg_date": "2025-12-30",
      "last_update_date": "2026-04-17 18:25:59",
      "options": "",
      "img_500": "",
      "location": "",
      "memo": "",
      "category": null,
      "extra_column1~10": ""
    }
  ]
}
```

**주요 필드:**

| 필드 | 설명 |
|------|------|
| `product_id` | 상품 고유 ID |
| `name` | 상품명 |
| `supply_code` | 공급처 코드 (get_etc_info supply 참조) |
| `org_price` | 원가 |
| `shop_price` | 판매가 |
| `supply_price` | 공급가 |
| `barcode` | 바코드 |
| `enable_sale` | 판매 가능 (1=가능, 0=불가) |
| `use_temp_soldout` | 임시 품절 (0=정상, 1=품절) |
| `options` | 옵션 정보 |
| `stock_alarm1/2` | 재고 알림 수량 |

---

### 2. get_etc_info — 기타 정보 조회

**요청:**
```
action=get_etc_info
search_type=[타입]
```

**search_type 매핑:**

| 한글(문서) | search_type | 응답 형식 | 데이터 |
|-----------|-------------|----------|--------|
| 판매처 | `shop` | `[{code, name}]` | 90개+ (10008~10101) |
| 공급처 | `supply` | `[{code, name}]` | 313개 (20xxx) |
| 택배사 | `trans` | `[{code, name}]` | CJ대한통운(30003), 롯데택배(30079), 번개배송(30118) |
| 화주 | `warehouse` | `[{seq, name}]` | 기본창고(seq=1) **주의: code 아닌 seq** |
| 재고타입 | `stock_type` | `[]` | 빈 배열 (미설정) |
| 카테고리 | `category` | `[]` | 빈 배열 (미설정) |
| 재고작업타입 | `job_type` | `{key: {code, name}}` | **객체** (배열 아님!) |

**응답 예시 (trans):**
```json
{
  "error": 0,
  "msg": "success",
  "data": [
    {"code": "30003", "name": "CJ대한통운"},
    {"code": "30079", "name": "롯데택배"},
    {"code": "30118", "name": "번개배송"}
  ]
}
```

**응답 예시 (job_type) — 다른 search_type과 구조가 다름!:**
```json
{
  "error": 0,
  "msg": "success",
  "data": {
    "in": {"code": "1", "name": "반품입고"},
    "out": {"code": "1", "name": "반품출고"},
    "trans": {"code": "0", "name": "기본배송"},
    "shift": {"code": "0", "name": "기본이동"},
    "arrange": {"code": "0", "name": "기본조정"}
  }
}
```

---

### 3. get_stock_info — 현재고 조회

**요청 (필수 파라미터):**
```
action=get_stock_info
type=[조회타입]     (필수: product_id, link_id, barcode, supply_code)
ids=[검색값]        (필수: 해당 타입의 ID/코드 값)
```

**선택 파라미터:**
- `warehouse_seq`: 창고 번호
- `stock_type`: 재고 타입
- `include_ready_trans`: 출고대기 포함 여부
- `page`, `limit`: 페이지네이션 (type=supply_code 시)

**테스트 예시:**
```
# product_id로 조회
type=product_id&ids=22197

# barcode로 조회
type=barcode&ids=8809762411305

# supply_code로 조회 (페이지네이션 포함)
type=supply_code&ids=20217
```

**응답 (type=product_id):**
```json
{
  "error": 0,
  "msg": "success",
  "data": {
    "22197": {
      "product_id": "22197",
      "link_id": "",
      "barcode": "8809762411305",
      "stock": {
        "1": {
          "warehouse_seq": "1",
          "stock": 0
        }
      }
    }
  }
}
```

**주요 특징:**
- 응답의 `data`는 **객체** (product_id를 키로 사용), 배열 아님
- 각 상품 안의 `stock`도 **객체** (warehouse_seq를 키로 사용)
- `ids` 파라미터명이 핵심 (product_id, barcode 등이 아님!)
- type=supply_code 시 `total`, `page`, `limit` 필드 추가됨

---

### 4. get_order_info — 주문 조회

**필수 파라미터:**
```
action=get_order_info
date_type=[날짜타입]     (필수)
start_date=YYYY-MM-DD   (필수)
end_date=YYYY-MM-DD     (필수)
```

**date_type 값:**
`order_date`, `collect_date`, `ready_date`, `trans_date`, `trans_date_pos`, `cancel_date`, `change_date`, `cs_date`

**선택 파라미터:**

| 파라미터 | 설명 |
|---------|------|
| `status` | 주문상태 필터 |
| `order_cs` | CS상태 필터 |
| `hold` | 보류상태 필터 |
| `order_id` | 주문번호 |
| `trans_no` | 송장번호 |
| `product_id` | 상품코드 |
| `seq` | 관리번호 |
| `shop_id` | 판매처코드 |
| `sub_domain_seq` | 화주번호 (get_etc_info warehouse의 seq) |
| `packing_type` | single_qty, multi_qty, single_product, multi_product, single_product_multi_qty |
| `page` | 페이지 번호 |
| `limit` | 건수 (10, 30, 50, 100, 300, 500, 1000) |

**sub_domain_seq 참고:**
- `20`: 363건 주문 확인 (start_date/end_date 사용)
- Notion 문서에서는 "화주번호"로 설명, get_etc_info warehouse에서 확인

**응답:**
```json
{
  "error": 0,
  "msg": "success",
  "total": "363",
  "pack_cnt": "131",
  "product_sum": "381",
  "data": [
    {
      "pack": "0",
      "seq": "444988",
      "status": "8",
      "order_cs": "0",
      "hold": "0",
      "shop_id": "10021",
      "order_id": "202603031606155",
      "order_id_seq": "202603031606155-001",
      "order_id_seq2": "202603031606155-D1",
      "order_type": "",
      "shop_product_id": "134",
      "product_name": "Alpaca long-sleeve knit / 5 Colors",
      "options": "Color : PINK, Size : M",
      "qty": "1",
      "order_name": "정서*",
      "order_mobile": "010****3439",
      "recv_name": "조부*",
      "recv_mobile": "010****3912",
      "recv_address": "충남 부여군...",
      "recv_zip": "33126",
      "memo": "",
      "trans_corp": "30079",
      "trans_no": "410141677584",
      "trans_who": "선불",
      "order_date": "2026-03-03 09:08:55",
      "collect_date": "2026-03-03 15:54:13",
      "ready_date": "2026-03-03 15:55:49",
      "trans_date": "2026-03-03 15:56:08",
      "trans_date_pos": "2026-03-03 16:58:06",
      "amount": "28770",
      "sub_domain_seq": "20",
      "order_products": [
        {
          "seq": "435514",
          "order_cs": "0",
          "product_id": "05884",
          "link_id": "",
          "qty": "1",
          "supply_code": "20048",
          "prd_amount": "28770",
          "prd_supply_price": "0",
          "extra_money": "0",
          "is_gift": "0",
          "cancel_date": "",
          "change_date": ""
        }
      ]
    }
  ]
}
```

**주문 주요 필드:**

| 필드 | 설명 |
|------|------|
| `status` | 주문 상태 ("1"=접수, "7"=승장, "8"=배송) |
| `order_cs` | CS상태 ("0"=정상, "1"=배송전 전체취소, ...) |
| `hold` | 보류상태 ("0"=정상, "1"=일반, "4"=전체취소, ...) |
| `order_id` | 주문 번호 |
| `shop_id` | 판매처 코드 (get_etc_info shop 참조) |
| `trans_corp` | 택배사 코드 (get_etc_info trans 참조) |
| `trans_no` | 운송장 번호 |
| `order_date` | 주문일시 |
| `collect_date` | 집화일시 |
| `trans_date` | 출고일시 |
| `trans_date_pos` | 배송완료일시 |
| `amount` | 주문 금액 |
| `order_products` | 주문 상품 배열 |

**참고:** `sdate`/`edate` 파라미터도 동작하나, 공식 Notion 명세는 `start_date`/`end_date`.
`start_date`/`end_date` 사용 시 더 많은 데이터 반환 확인 (363 vs 252건).

---

### 5. get_stock_tx_info — 재고 변동량 조회

**요청:**
```
action=get_stock_tx_info
page=1
limit=10
```

**응답 구조:**
```json
{
  "product_id": {
    "warehouse_seq": [
      [
        {"job": "in", "job_type": "0", "qty": "14"},
        {"job": "stock", "job_type": "0", "qty": "14"}
      ]
    ]
  }
}
```

- `job`: 작업 유형 (in=입고, stock=재고, trans=출고 등)
- `qty`: 수량

---

### 6. get_stock_tx_detail_info — 재고 이력 상세

**요청:**
```
action=get_stock_tx_detail_info
page=1
limit=10
```

**응답:**
```json
{
  "error": 0,
  "msg": "success",
  "total": "277",
  "sum": "10575",
  "data": [
    {
      "seq": "324076",
      "crdate": "2026-04-20 17:58:03",
      "product_id": "26110",
      "warehouse_seq": "1",
      "stock_type": "0",
      "job": "trans",
      "job_type": "0",
      "qty": "1",
      "stock": "12",
      "order_seq": "482027",
      "worker": "saenip",
      "memo": "[원스캔]"
    }
  ]
}
```

**주요 필드:**

| 필드 | 설명 |
|------|------|
| `job` | 작업 유형 (trans=출고, in=입고 등) |
| `qty` | 변동 수량 |
| `stock` | 변동 후 재고 |
| `order_seq` | 관련 주문 번호 |
| `worker` | 작업자 |

---

## 특이사항

- `get_stock_tx_info`: 응답에 `{error, msg, data}` wrapper가 **없음**. 중첩 JSON이 직접 반환됨.
- `get_stock_info`: 응답의 `data`는 **객체** (배열 아님). product_id를 키로 사용. 검색값 파라미터는 `ids`.
- `get_etc_info warehouse`: 다른 search_type은 `{code, name}` 반환하지만 warehouse만 `{seq, name}` 반환.
- `get_etc_info job_type`: 다른 search_type은 배열 반환하지만 job_type만 객체 반환.
- `get_product_info`: `product_code` 등 필터 파라미터 미지원 (page/limit만 가능).
- `get_order_info`: `start_date`/`end_date`가 공식 파라미터 (`sdate`/`edate`도 동작하지만 결과 다름).

## 미확인 API

| API | 상태 | 비고 |
|-----|------|------|
| `get_code_match` | `invalid action` 응답 | Notion 명세에 파라미터 존재하나 서버에서 비활성화 추정 |

---

_최종 업데이트: 2026-04-21 (3차 - Notion API 명세 확인, get_stock_info 해결)_
