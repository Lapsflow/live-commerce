# ONEWMS-FMS API Client Library

TypeScript 기반 ONEWMS-FMS API 클라이언트 라이브러리입니다.

## 📦 설치

이미 프로젝트에 포함되어 있습니다. 별도 설치 불필요.

## 🔧 설정

### 환경 변수 설정 (.env)

```bash
ONEWMS_PARTNER_KEY=52bd55d7d931cb002c8569099fe9bda1
ONEWMS_DOMAIN_KEY=eb731e190a51a6364185d7cf11641aa2
ONEWMS_API_URL=https://api.onewms.co.kr/api.php
```

### 코드에서 설정

```typescript
import { setOnewmsConfig } from '@/lib/onewms';

setOnewmsConfig({
  partnerKey: '52bd55d7d931cb002c8569099fe9bda1',
  domainKey: 'eb731e190a51a6364185d7cf11641aa2',
});
```

## 📚 사용법

### 기본 사용

```typescript
import { createOnewmsClient } from '@/lib/onewms';

// 클라이언트 생성
const client = createOnewmsClient();

// 주문 조회
const order = await client.getOrderInfo('ORDER-123');
console.log(order);
```

### 주문 관리

```typescript
// 주문 생성
await client.createOrder({
  order_no: 'ORDER-123',
  order_date: '2026-04-09',
  recipient_name: '홍길동',
  recipient_phone: '010-1234-5678',
  recipient_address: '서울시 강남구',
  products: [
    { product_code: 'PROD-001', quantity: 2 },
    { product_code: 'PROD-002', quantity: 1 },
  ],
});

// 송장번호 입력
await client.setTransportNumber({
  order_no: 'ORDER-123',
  trans_no: '1234567890',
});

// 배송처리
await client.setTransportPos({ order_no: 'ORDER-123' });

// 배송취소
await client.cancelTransportPos({ order_no: 'ORDER-123' });

// 송장 이미지 조회
const invoiceUrl = await client.getTransportInvoice('1234567890');

// 주문 라벨 지정
await client.setOrderLabel({
  order_no: 'ORDER-123',
  label: 'urgent',
});
```

### 상품 관리

```typescript
// 상품 정보 조회
const product = await client.getProductInfo('PROD-001');
console.log(product.product_name);

// 상품 등록
await client.addProduct({
  product_code: 'PROD-001',
  product_name: '테스트 상품',
  barcode: '8801234567890',
});

// 코드 매칭 조회
const match = await client.getCodeMatch('INTERNAL-001');
```

### 재고 관리

```typescript
// 현재고 조회
const stock = await client.getStockInfo('PROD-001');
console.log(`가용재고: ${stock.available_qty}`);
console.log(`총재고: ${stock.total_qty}`);

// 재고 변동 내역 조회
const transactions = await client.getStockTxInfo(
  'PROD-001',
  '2026-04-01',
  '2026-04-09'
);

// 재고 이력 상세 조회
const details = await client.getStockTxDetailInfo(
  'PROD-001',
  '2026-04-01',
  '2026-04-09'
);
```

### 전표 관리

```typescript
// 전표 목록 조회
const sheets = await client.getSheetList('2026-04-01', '2026-04-09');

// 전표 등록
await client.addSheet({
  sheet_type: 'INBOUND',
  sheet_date: '2026-04-09',
  products: [
    { product_code: 'PROD-001', quantity: 100 },
  ],
});
```

### 원다스 조회

```typescript
// 포장번호 조회
const packing = await client.getOnedasPackingNo('ORDER-123');

// 포장번호 상세 조회
const packingDetail = await client.getOnedasPackingNoDetail('PACK-001');
```

## 🔢 상태 코드

### 주문상태 (OrderStatus)

```typescript
import { OrderStatus } from '@/lib/onewms';

OrderStatus.RECEIVED   // 1: 접수
OrderStatus.APPROVED   // 7: 승장
OrderStatus.SHIPPED    // 8: 배송
```

### CS상태 (CsStatus)

```typescript
import { CsStatus } from '@/lib/onewms';

CsStatus.NORMAL                        // 0: 정상
CsStatus.PRE_DELIVERY_FULL_CANCEL      // 1: 배송전 전체 취소
CsStatus.PRE_DELIVERY_PARTIAL_CANCEL   // 2: 배송전 부분 취소
CsStatus.POST_DELIVERY_FULL_CANCEL     // 3: 배송후 전체 취소
CsStatus.POST_DELIVERY_PARTIAL_CANCEL  // 4: 배송후 부분 취소
CsStatus.PRE_DELIVERY_FULL_EXCHANGE    // 5: 배송전 전체 교환
CsStatus.PRE_DELIVERY_PARTIAL_EXCHANGE // 6: 배송전 부분 교환
CsStatus.POST_DELIVERY_FULL_EXCHANGE   // 7: 배송후 전체 교환
CsStatus.POST_DELIVERY_PARTIAL_EXCHANGE // 8: 배송후 부분 교환
```

### 보류상태 (HoldStatus)

```typescript
import { HoldStatus } from '@/lib/onewms';

HoldStatus.NORMAL          // 0: 정상
HoldStatus.GENERAL         // 1: 일반
HoldStatus.ADDRESS_CHANGE  // 2: 주소변경
HoldStatus.EXCHANGE        // 3: 교환
HoldStatus.FULL_CANCEL     // 4: 전체취소
HoldStatus.PARTIAL_CANCEL  // 5: 부분취소
HoldStatus.MERGE_CHANGE    // 6: 합포변경
```

## ⚠️ 에러 처리

```typescript
import { OnewmsApiError } from '@/lib/onewms';

try {
  await client.getOrderInfo('ORDER-123');
} catch (error) {
  if (error instanceof OnewmsApiError) {
    console.error(`API Error [${error.code}]: ${error.message}`);
    console.error('Response:', error.response);
  } else {
    console.error('Network Error:', error);
  }
}
```

## 📖 API 문서

전체 API 명세는 [ONEWMS-FMS API 문서](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f)를 참고하세요.

## 🔗 라이브 커머스 통합

이 라이브러리는 라이브 커머스 플랫폼의 주문 관리 시스템과 연동되어 사용됩니다:

- 주문 생성 시 ONEWMS로 자동 전송
- 재고 실시간 동기화
- 배송 처리 자동화

## 📝 라이선스

MIT License
