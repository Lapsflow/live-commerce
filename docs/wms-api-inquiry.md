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

감사합니다.
