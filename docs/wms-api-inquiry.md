# 원WMS API 2차 문의

> 아래 내용을 복사하여 원WMS 측에 전달

---

안녕하세요,

지난 안내 감사합니다.
추가 테스트를 진행한 결과, 아래 3개 항목이 아직 해결되지 않았습니다.
정상 호출 예시를 포함하여 안내 부탁드립니다.

---

## 1. get_stock_info — 현재고 조회 (미해결)

`type=product_id`, `type=barcode`, `type=supply_code` 3개 모두
`"invalid parameter"` 오류가 발생합니다.

아래 조합을 모두 테스트했으나 동일한 오류입니다:

```
# type만 전달
action=get_stock_info&type=product_id&page=1&limit=3

# type + 검색값 (다양한 파라미터명)
action=get_stock_info&type=product_id&product_id=22197
action=get_stock_info&type=product_id&keyword=22197
action=get_stock_info&type=product_id&value=22197
action=get_stock_info&type=product_id&code=22197
action=get_stock_info&type=product_id&search=22197
action=get_stock_info&type=product_id&search_value=22197
action=get_stock_info&type=product_id&data=22197

# type + warehouse_seq / sub_domain_seq 조합
action=get_stock_info&type=product_id&product_id=22197&warehouse_seq=1
action=get_stock_info&type=product_id&product_id=22197&sub_domain_seq=20
action=get_stock_info&type=product_id&product_id=22197&stock_type=1

# barcode, supply_code도 동일
action=get_stock_info&type=barcode&barcode=8809762411305
action=get_stock_info&type=supply_code&supply_code=20217

# GET 방식으로도 테스트 — 동일한 오류
```

**문의:**
- **정상적으로 호출 가능한 완전한 요청 예시**를 하나 보내주시면 감사하겠습니다.
- 위 조합 외에 추가로 필요한 파라미터가 있나요?

---

## 2. get_code_match — 매칭정보 조회 (미해결)

POST, GET 모두 `"invalid action"` 오류가 발생합니다.

```
# POST
curl -X POST https://api.onewms.co.kr/api.php \
  -d 'partner_key=...&domain_key=...&action=get_code_match&page=1&limit=10'

# GET
curl 'https://api.onewms.co.kr/api.php?partner_key=...&domain_key=...&action=get_code_match&page=1&limit=10'
```

응답: `{"error":1,"msg":"invalid action"}`

API 문서에 `get_code_match`가 존재하는 것을 확인했습니다.

**문의:**
- 해당 API가 현재 활성화되어 있나요?
- 활성화되어 있다면, 정상 호출 예시를 안내 부탁드립니다.

---

## 3. get_order_info — sub_domain_seq (미해결)

주문 조회 시 `sub_domain_seq` 없이 호출하면 빈 결과가 반환됩니다.
현재 `sub_domain_seq=20`에서 주문 데이터를 확인했습니다.

**문의:**
- 사용 가능한 `sub_domain_seq` 전체 목록을 조회하는 방법이 있나요?
- 또는 전체 판매처 주문을 한 번에 조회하는 방법이 있나요?

---

## 4. set_orders — 본문 형식 명시 부재 (신규 / 핵심)

공식 문서 02-set_orders.md 에 다음 사항이 명시되어 있지 않아 정확한 호출 형식을
결정할 수 없습니다. 발주 컨펌 시 200 OK 응답이라도 ONEWMS 측에서 실제 등록이
누락되어 슈퍼무진 → ONEWMS 주문조회가 안 되는 사례가 운영에서 발생 중입니다.

**문의 — set_orders 정상 호출 curl 예시 1건 부탁드립니다.** 다음 사항을 명확히
확인 부탁드립니다.

(1) **Content-Type**: `application/x-www-form-urlencoded` 인지 `application/json`
    인지 (16-onedas_packing.md 의 get_onedas_packing_no_detail 은 application/json
    을 사용. set_orders 도 동일한가요?)

(2) **JSON 배열 위치**:
    - (a) URL query 에 partner_key/domain_key/action/shop_id/collect_date,
          body 에 raw JSON 배열 `[{...},{...}]` — add_sheet_items 패턴
    - (b) form body 에 `data=[{...},{...}]` 처럼 키로 감싸기
    - (c) form body 에 `orders=[{...},{...}]` 처럼 다른 키
    - (d) 그 외

(3) **sub_domain_seq 전달 필요 여부**: 위 #3 의 sub_domain_seq=20 환경에서
    set_orders 호출 시 화주 식별을 위해 sub_domain_seq 를 query 에 명시적으로
    포함해야 하나요? (현재는 shop_id 만 보내고 있음)

(4) **셀러 식별자 매핑**: 슈퍼무진은 다수의 셀러가 한국무진유통(shop_id 10063)
    이라는 단일 판매처로 발주합니다. ONEWMS 측에서 어떤 셀러의 주문인지 구분
    가능하도록 `cust_id` 에 셀러 username 을 넣으면 운영 화면에서 식별
    가능한가요? 다른 권장 필드가 있다면 안내 부탁드립니다.

**참고 — 현재 운영 호출 페이로드**:
```
URL query: action=set_orders, shop_id=10063, collect_date=26-05-22
Headers: Content-Type: application/json
Body: [
  {
    "order_id": "LIVE-20260522-A1B2C",
    "order_id_seq": "1",
    "shop_product_id": "PROD123",
    "qty": 2,
    "recv_name": "홍길동",
    "recv_mobile": "01012345678",
    "recv_address": "서울시 ...",
    "product_name": "테스트상품",
    "order_date": "2026-05-22",
    "order_time": "10:30:00",
    "order_name": "셀러A",
    "order_mobile": "01099998888",
    "cust_id": "seller_a"
  }
]
```

---

감사합니다.
