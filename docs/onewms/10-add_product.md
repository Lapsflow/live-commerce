# ONEWMS API: add_product (상품추가)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=1f4f9e2dd6368044af0ae9e5ab63ade7&pm=s)

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `add_product` |
| 타입 | 상품 |
| 설명 | 상품정보를 생성 |

## 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `name` | String | **O** | 상품명 |
| `supply_code` | String | X | 공급처 코드 (기본값: 자사) |
| `barcode` | String | X | 바코드 (미입력 시 자동 생성) |
| `link_id` | String | X | 연동코드 (우리쪽 상품 식별자 권장) |
| `origin` | String | X | 원산지 |
| `maker` | String | X | 제조사 |
| `brand` | String | X | 공급처 상품명 |
| `org_price` | Number | X | 원가 |
| `supply_price` | Number | X | 공급가 |
| `shop_price` | Number | X | 판매가 |
| `market_price` | Number | X | (예제에 사용) 시장가 |
| `stock_manage` | String | X | 옵션 관리 여부 (`1`=관리, `0`=미관리) |
| `options` | String | X | 옵션 정보. 형식: `옵션명1:옵션값1,옵션값2\|\|옵션명2:옵션값1,옵션값2` |

## 응답
```json
{
  "error": 0,
  "msg": "success",
  "link_id": "요청에서 제공한 link_id",
  "product_id": ["00001", "S00002", "S00003"]
}
```

> 옵션관리=1 일 때 모상품 1개 + 옵션상품 N개가 생성되어 `product_id` 배열로 반환됨

## 예제 — 옵션관리 미사용
```bash
curl -X POST 'https://api.onewms.co.kr/api.php' \
 -d 'partner_key=YOUR_PARTNER_KEY' \
 -d 'domain_key=YOUR_DOMAIN_KEY' \
 -d 'action=add_product' \
 -d 'name=프리미엄 티셔츠4' \
 -d 'supply_code=20001' \
 -d 'link_id=T12345' \
 -d 'barcode=B12345' \
 -d 'origin=대한민국' \
 -d 'maker=패션브랜드' \
 -d 'brand=프리미엄' \
 -d 'org_price=10000' \
 -d 'market_price=15000' \
 -d 'supply_price=12000' \
 -d 'shop_price=19900'
# {"error":0,"msg":"success","link_id":"T12345","product_id":["01626"]}
```

## 예제 — 옵션관리 사용
```bash
curl -X POST 'https://api.onewms.co.kr/api.php' \
 -d 'partner_key=...' -d 'domain_key=...' -d 'action=add_product' \
 -d 'name=프리미엄 티셔츠' -d 'link_id=T12345' \
 -d 'org_price=10000' -d 'market_price=15000' \
 -d 'supply_price=12000' -d 'shop_price=19900' \
 -d 'stock_manage=1' \
 -d 'options=색상:흰색,검정||사이즈:S,M,L'
# {"error":0,"msg":"success","link_id":"T12345","product_id":["01611","S01612","S01613","S01614","S01615","S01616","S01617"]}
```

## 슈퍼무진 구현
`client.ts` — `addProduct(data)` (호출처 없음 — 미활용)

## ⚠️ 주의
- `link_id` 를 우리쪽 `product.id` 와 일치시켜 두면 향후 매칭 누락 추적에 유리
- 옵션관리=1 사용 시 응답의 `product_id[0]` 이 모상품, `[1..]` 가 옵션상품 (`S` 접두)
