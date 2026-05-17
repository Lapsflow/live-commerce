# ONEWMS API: set_orders (주문생성)

> **출처**: [Notion 공식](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=1a4f9e2dd63680e895dddd00967c67b6&pm=s)
> 마지막 편집: 2025-05-22 / 추출일: 2026-05-13

## 기본 정보
| 항목 | 값 |
|---|---|
| 함수명 | `set_orders` |
| 타입 | 주문 |
| 설명 | 주문정보를 생성 |

## 파라미터
| parameter | 항목 | 필수 | 형식 | 기본값 | 비고 |
|---|---|---|---|---|---|
| `shop_id` | 판매처코드 | **O** | | | **사용자정의 판매처만 가능** (shop_code: usermanual) |
| `collect_date` | 발주일 | | `YY-MM-DD` | 현재일자 | 값 입력시 해당 일자로 발주일 입력 |

## JSON 파라미터 (주문 배열)

| field | 항목 | 필수 | 데이터타입 | 기본값 | 비고 |
|---|---|---|---|---|---|
| `order_id` | 주문번호 | **O** | varchar(40) | | |
| `order_id_seq` | 주문상세번호 | | varchar(255) | | |
| `order_id_seq2` | 주문상세번호2 | | varchar(255) | | |
| `order_type` | 주문구분 | | varchar(255) | | |
| `order_type2` | 주문구분2 | | varchar(255) | | |
| `shop_product_id` | 판매처상품코드 | **O** | varchar(255) | | |
| `product_name` | 판매처상품명 | | varchar(255) | | |
| `options` | 판매처옵션 | | varchar(255) | | |
| `qty` | 주문수량 | **O** | int(11) | | |
| `trans_who` | 선착불 | | varchar(20) | 선불 | 선불/착불 |
| `order_date` | 주문일자 | | date | | |
| `order_time` | 주문일시 | | time | | |
| `order_name` | 주문자명 | | varchar(100) | | |
| `order_tel` | 주문자연락처 | | varchar(20) | | |
| `order_mobile` | 주문자핸드폰 | | varchar(20) | | |
| `order_email` | 주문자이메일 | | varchar(50) | | |
| `order_zip` | 주문자우편번호 | | varchar(10) | | |
| `order_address` | 주문자주소 | | varchar(255) | | |
| `recv_name` | 수령자명 | **O** | varchar(100) | | |
| `recv_tel` | 수령자연락처 | | varchar(20) | | |
| `recv_mobile` | 수령자핸드폰 | | varchar(20) | | |
| `recv_email` | 수령자이메일 | | varchar(50) | | |
| `recv_zip` | 수령자우편번호 | | varchar(10) | | |
| `recv_address` | 수령자주소 | | varchar(255) | | |
| `memo` | 배송메모 | | varchar(255) | | |
| `cust_id` | 고객ID | | varchar(30) | | |
| `trans_due_date` | 배송예정일 | | date | | |

### JSON 예시

```json
[
  {
    "order_id": "TEST_ORDER_101",
    "recv_name": "김테스트",
    "shop_product_id": "PROD101",
    "qty": 2,
    "recv_mobile": "01012345678",
    "product_name": "테스트상품101",
    "options": "색상:레드",
    "memo": "테스트주문101"
  },
  {
    "order_id": "TEST_ORDER_102",
    "recv_name": "이테스트",
    "shop_product_id": "PROD102",
    "qty": 1,
    "recv_mobile": "01023456789",
    "product_name": "테스트상품102",
    "options": "사이즈:M"
  },
  {
    "order_id": "TEST_ORDER_103",
    "recv_name": "박테스트",
    "shop_product_id": "PROD103",
    "qty": 3,
    "recv_mobile": "01034567890",
    "product_name": "테스트상품103",
    "options": "색상:블루,사이즈:L",
    "memo": "테스트주문103"
  }
]
```

## 응답
| field | 항목 | 비고 |
|---|---|---|
| `error` | 에러코드 | |
| `msg` | 메시지 | |

## 슈퍼무진 구현
- `lib/onewms/client.ts:211` — `async createOrder(order: CreateOrderRequest)`
- `lib/services/onewms/orderSync.ts` — 발주 컨펌 시 호출
- ⚠️ **주의**: 필수 `shop_id` 가 우리 코드에 명시적으로 전달되는지 확인 필요
