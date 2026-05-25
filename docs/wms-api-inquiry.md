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

## 4. set_orders — success 응답인데 주문이 실제로 등록 안 됨 (★ 가장 핵심)

자체 검증 7회 수행 후에도 원인 미확정. 한국무진(슈퍼무진) 측 ONEWMS
운영자 화면에서 직접 확인이 필요합니다.

### 자체 검증으로 확정된 사실 (코드 수정 완료)

- ✅ `shop_id=10063` = 한국무진유통 (get_etc_info 로 확인)
- ✅ `sub_domain_seq=62` = 한국무진유통 화주 (get_etc_info?search_type=sub_domain
  응답의 code='62', shop=['10063'] 확인 — 우리 코드는 sub_domain_seq=62
  자동 전달하도록 수정 완료)
- ✅ get_order_info 정상 호출 (read 권한 정상). 한국무진유통 영역에서 30일간
  total=530 건 조회 가능
- ✅ set_orders 호출 형식: application/json + URL query + raw JSON 배열 body
  (16-onedas_packing.md 의 curl 예시와 동일 패턴). 모든 응답이 `error:0 success`

### 미해결 — 슈퍼무진이 보낸 set_orders 가 등록되지 않음

다음 3가지 형식으로 set_orders 호출 → 모두 `{"error":0,"msg":"success"}` 응답
→ 5초 후 get_order_info (shop_id=10063, sub_domain_seq=62, 동일 order_id
지정) 로 조회 → **3건 모두 total=0 (등록 안 됨)**.

| order_id 형식 | set_orders 응답 | 조회 결과 |
|---|---|---|
| `99996305826` (순수 숫자 11자리) | success | total=0 |
| `LIVE-20260524-9OXPE` (영숫자) | success | total=0 |
| `20260524041825` (14자리 timestamp) | success | total=0 |

### 한국무진/임찬영님께 확인 요청

**(1) ONEWMS 관리자 화면에서 위 3개 order_id 검색**:
- `99996305826`, `LIVE-20260524-9OXPE`, `20260524041825`
- shop_id=10063 / sub_domain_seq=62 영역에 실제로 존재하는지
- 만약 다른 화주 영역에 있다면 어느 sub_domain 인지

**(2) 우리 partner_key (52bd55d7...bda1) 의 set_orders 쓰기 권한 상태**:
- 읽기(get_*) 권한은 정상 작동
- 쓰기(set_orders) 가 silent success 로만 응답하고 실제 등록이 안 되는데,
  권한 분리가 되어 있는지 확인 필요

**(3) 정상 호출 curl 예시 1건 회신 부탁**:
- 임찬영님 측에서 set_orders 가 실제 등록 성공하는 호출 예시 (curl 또는
  Postman) 한 건만 회신 주시면, 우리 호출과 1:1 비교해서 정확한 차이
  지점 파악 가능합니다.

**(4) 셀러 식별자 매핑 권장 필드**:
- 슈퍼무진은 다수의 셀러가 한국무진유통(shop_id 10063) 단일 판매처로 발주합니다.
- ONEWMS 화면에서 셀러별 구분이 필요한데 `cust_id` 에 셀러 username 을 넣으면
  되나요? 다른 권장 필드가 있다면 안내 부탁드립니다.

### 참고 — 슈퍼무진의 현재 set_orders 호출 페이로드

```
URL query:
  partner_key=52bd55d7d931cb002c8569099fe9bda1
  domain_key=eb731e190a51a6364185d7cf11641aa2
  action=set_orders
  shop_id=10063
  collect_date=26-05-22

Headers:
  Content-Type: application/json

Body:
[
  {
    "order_id": "LIVE-20260524-9OXPE",
    "order_id_seq": "1",
    "shop_product_id": "705",
    "qty": 1,
    "recv_name": "검증",
    "recv_mobile": "01000000077",
    "recv_address": "서울 검증로 7",
    "product_name": "검증 더미",
    "order_date": "2026-05-24",
    "order_time": "10:30:00",
    "order_name": "셀러A",
    "order_mobile": "01099998888",
    "cust_id": "seller_a"
  }
]
```

위 호출에 대해 ONEWMS 응답: `{"error":0,"msg":"success"}` — 그러나 조회 시
한국무진유통(sub_domain_seq=62) 영역에 존재하지 않음.

---

## 5. ONEWMS get_stock_info API vs ONEWMS 운영 UI 화면 재고 불일치 (신규)

운영 중 셀러가 발견. 슈퍼무진과 ONEWMS API 는 동일한 값을 보지만, ONEWMS
운영 UI 화면은 다른 값을 보여줍니다. 즉 ONEWMS 내부의 API 와 UI 간 정합성
문제입니다. 슈퍼무진 측에서는 수정 불가능 — 한국무진 측 확인이 필요합니다.

### 사례

- **상품**: `[827]부케가르니 딥 퍼퓸 세탁세제 화이트머스크(2개입)`
- **ONEWMS product_id**: 25943
- **barcode**: 8809981364710

| 위치 | 표시된 재고 |
|---|---|
| 슈퍼무진 DB totalStock | 6 |
| ONEWMS get_stock_info API 응답 (warehouse_seq=1 기본창고) | 6 |
| ONEWMS 운영 UI (셀러가 본 화면) | **1** |

ONEWMS API 응답 raw:
```
{"error":0,"msg":"success","data":{"25943":{"product_id":"25943","link_id":"",
"barcode":"8809981364710","stock":{"1":{"warehouse_seq":"1","stock":"6"}}}}}
```

슈퍼무진은 위 API 응답대로 1분마다 자동 동기화하여 totalStock=6 으로 정확
반영하고 있습니다. 그러나 셀러가 ONEWMS 운영 UI 에서 본 재고는 1 입니다.

### 확인 요청

(1) ONEWMS UI 의 "1개" 는 어느 warehouse_seq 의 재고인지, 또는 어떤 필터
    (가용재고/예약차감/미입고 분리 등)가 적용된 값인지 확인 부탁드립니다.

(2) product_id=25943 의 정확한 현재고를 한국무진 측에서 직접 ONEWMS 관리자
    화면에서 확인 후, API 응답 값(6) 과 UI 표시 값(1) 중 어느 쪽이 진짜
    실재고인지 알려주시기 바랍니다.

(3) API 와 UI 가 서로 다른 값을 표시하는 구조가 정상인지, 아니면 ONEWMS
    내부 동기화 문제인지 확인 부탁드립니다.

(4) 셀러는 ONEWMS UI 의 1을 기준으로 방송 판매를 진행해야 하는지, 슈퍼무진
    의 6을 기준으로 해야 하는지 정책 결정이 필요합니다.

---

감사합니다.
