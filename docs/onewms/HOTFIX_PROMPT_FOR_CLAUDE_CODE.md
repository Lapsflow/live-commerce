# [ONEWMS P0 핫픽스] Claude Code 작업 지시서

> 작성: 2026-05-17 / 작성자: PM 검토 (Cowork)
> 실행 환경: Claude Code (로컬, 운영코드 직접 수정)
> 예상 작업 시간: 45~60분
> 보리스 원칙 #4 적용: 코드 작성 전 이 문서를 정독하고 **반드시 written plan 을 먼저 제시**할 것.

---

## 0. 미션 한 줄
**ONEWMS `set_orders` / `set_trans_no` / `get_order_info` 필드명 불일치 핫픽스 + `shop_id` 부트스트랩.**

운영에서 발주 컨펌 시 ONEWMS 가 100% 거부 중인 사일런트 실패를 종결한다.

---

## 1. 배경 — 반드시 먼저 읽을 것

### 공식 문서 (16개 API, 모두 fetch 완료)
- `docs/onewms/00-INDEX.md` — 전체 인덱스
- `docs/onewms/02-set_orders.md` — **핵심**, 필드명 모두 여기서
- `docs/onewms/03-set_trans_no.md`
- `docs/onewms/01-get_order_info.md`
- `docs/onewms/11-get_etc_info.md` — shop_id 확보용
- `docs/onewms/99-GAP_ANALYSIS.md` — 차이 정리

### 발견된 갭 (요약)
| API | 우리 코드 (잘못) | 공식 (맞음) |
|---|---|---|
| `set_orders` | `order_no`, `recipient_name`, `recipient_phone`, `recipient_address`, `products:[{product_code,quantity}]` (top-level), **shop_id 없음** | `order_id`, `recv_name`, `recv_mobile`, `recv_address`, **JSON 배열** = 주문 row N개, **shop_id (query 필수)** |
| `set_trans_no` | `order_no`, `trans_no` | `seq`(관리번호), `trans_corp`(택배사), `trans_no` |
| `get_order_info` | `order_no` 로 필터 (존재 X) | `order_id` 또는 `seq` 또는 `trans_no` |

### 영향받는 파일
1. `lib/onewms/types.ts` — `CreateOrderRequest`, `SetTransportNumberRequest` 타입
2. `lib/onewms/client.ts` — `getOrderInfo()` 의 `order_no` 파라미터 제거
3. `lib/onewms/config.ts` — `shop_id` 환경변수 추가
4. `lib/services/onewms/orderSync.ts` — `createOrder` 호출부 전면 재작성
5. `lib/services/onewms/deliverySync.ts` — `order_no` → `order_id` 수정
6. `.env.example` — `ONEWMS_SHOP_ID` 추가
7. `prisma/schema.prisma` — (선택) `OnewmsOrderMapping` 에 `onewmsOrderId` 별칭 컬럼 정리

---

## 2. 작업 절차

### Step 1. 계획 제시 (코드 X)
다음 항목을 written plan 으로 먼저 출력:
- (a) 타입 변경 전/후 diff 요약
- (b) `orderSync.ts:86-96` 신규 매핑 의사코드
- (c) `shop_id` 확보 전략 (env vs bootstrap script 둘 다)
- (d) 마이그레이션 필요 여부 (`onewmsOrderNo` 컬럼명 그대로 둘지 결정)
- (e) 실패 시 롤백 절차

→ 사용자 (PM) 가 plan 확인 후 "go" 하면 Step 2 진행.

---

### Step 2. 타입 재정의 (`lib/onewms/types.ts`)

#### Before (lines 148-160)
```ts
export interface CreateOrderRequest {
  order_no: string;
  order_date: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  products: Array<{
    product_code: string;
    quantity: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}
```

#### After
```ts
/**
 * set_orders 의 단일 주문 row (공식 사양 1:1).
 * 한 주문 = 한 상품 1줄. 한 주문에 N개 상품이면 N개 row 를 보낸다.
 */
export interface CreateOrderRow {
  // 필수
  order_id: string;             // 우리 Order.orderNo (또는 Order.id)
  shop_product_id: string;      // product.onewmsCode
  qty: number;
  recv_name: string;            // Order.recipient

  // 선택 — 가능하면 모두 채울 것
  order_id_seq?: string;        // OrderItem 단위 식별 (orderItem.id)
  order_id_seq2?: string;
  product_name?: string;
  options?: string;
  trans_who?: '선불' | '착불';
  order_date?: string;          // YYYY-MM-DD
  order_time?: string;
  order_name?: string;
  order_tel?: string;
  order_mobile?: string;
  order_email?: string;
  order_zip?: string;
  order_address?: string;
  recv_tel?: string;
  recv_mobile?: string;         // Order.phone
  recv_email?: string;
  recv_zip?: string;
  recv_address?: string;        // Order.address
  memo?: string;
  cust_id?: string;
  trans_due_date?: string;
}

/**
 * set_orders 요청.
 * - `shop_id` 와 `collect_date` 는 query param 으로 form-encode
 * - `rows` 는 JSON.stringify 되어 'orders' (또는 공식 명세에 따른 키) 로 전송
 */
export interface CreateOrderRequest {
  shop_id: string;              // 필수 (사용자정의 판매처 코드)
  collect_date?: string;        // 발주일 YY-MM-DD
  rows: CreateOrderRow[];
}
```

⚠️ **client.ts 의 `createOrder` 구현도 함께 수정해야 함.** 공식 API 가 어떻게 JSON 배열을 받는지 docs/onewms/02-set_orders.md 의 예시를 확인하면 `JSON.stringify(rows)` 를 `data` 키로 보낼지 root 로 보낼지 결정.
→ 결정 근거: docs/onewms/02-set_orders.md 의 JSON 예시는 배열 자체 (top-level array) 이므로, 우리는 form-encode body 에서 별도 key 로 `data=[...]` 또는 `orders=[...]` 로 보낼 가능성 큼. **실제 호출 전 ONEWMS 측 임찬영님께 확인 권장**, 그게 어렵다면 `data=JSON.stringify(rows)` 로 먼저 시도하고 응답 보고 조정.

#### Before (lines 162-166)
```ts
export interface SetTransportNumberRequest {
  order_no: string;
  trans_no: string;
  [key: string]: unknown;
}
```

#### After
```ts
export interface SetTransportNumberRequest {
  seq: number | string;         // 관리번호 (get_order_info 응답의 seq)
  trans_corp: number;           // 택배사코드 (get_etc_info?search_type=trans)
  trans_no: number | string;    // 송장번호
  trans_pos?: 0 | 1;            // 0=송장입력, 1=배송처리 (기본 0)
  type?: 0 | 1 | 2;             // 0=송장입력, 1=변경, 2=추가송장 (기본 0)
}
```

또한 다음도 함께 수정:
- `SetTransportPosRequest`: `order_no` → `trans_no` (필수)
- `CancelTransportPosRequest`: `order_no` → `trans_no` (필수)
- `SetOrderLabelRequest`: `order_no, label` → `seq, label_name`

---

### Step 3. client.ts 수정

#### 3-1. `getOrderInfo` 의 파라미터에서 `order_no` 제거 (lines 185~205)
```ts
async getOrderInfo(params: {
  date_type: string;
  start_date: string;
  end_date: string;
  status?: string;
  order_cs?: string;
  hold?: string;
  order_id?: string;     // 주문번호
  // order_no?: string;  ← 제거
  trans_no?: string;
  product_id?: string;
  seq?: string;
  shop_id?: string;
  sub_domain_seq?: string;
  packing_type?: string;
  page?: number;
  limit?: number;
}): Promise<OrderInfo[]> { ... }
```

#### 3-2. `createOrder` 수정 (line 211)
```ts
async createOrder(req: CreateOrderRequest): Promise<void> {
  await this.request('set_orders', {
    shop_id: req.shop_id,
    collect_date: req.collect_date,
    data: JSON.stringify(req.rows),  // ⚠️ 공식 형태 확인 후 키 조정 가능성 있음
  });
}
```

---

### Step 4. `config.ts` 에 `shop_id` 추가

```ts
export function getOnewmsConfig(): OnewmsConfig & { shopId: string } {
  const partnerKey = process.env.ONEWMS_PARTNER_KEY;
  const domainKey = process.env.ONEWMS_DOMAIN_KEY;
  const shopId = process.env.ONEWMS_SHOP_ID;

  if (!partnerKey || !domainKey || !shopId) {
    throw new Error(
      'ONEWMS_PARTNER_KEY / ONEWMS_DOMAIN_KEY / ONEWMS_SHOP_ID 미설정. ' +
      '.env.local 확인 또는 scripts/onewms-bootstrap-shop.ts 실행.'
    );
  }
  return { partnerKey, domainKey, shopId, apiUrl: process.env.ONEWMS_API_URL };
}
```

타입에도 `shopId` 추가:
```ts
export interface OnewmsConfig {
  partnerKey: string;
  domainKey: string;
  shopId: string;           // ← 추가
  apiUrl?: string;
}
```

---

### Step 5. `.env.example` 갱신
```
ONEWMS_PARTNER_KEY=...
ONEWMS_DOMAIN_KEY=...
ONEWMS_SHOP_ID=        # get_etc_info?search_type=shop 로 확인. shop_code=usermanual 인 row 의 shop_id.
ONEWMS_API_URL=https://api.onewms.co.kr/api.php
```

---

### Step 6. `shop_id` 부트스트랩 스크립트 신설

파일: `scripts/onewms-bootstrap-shop.ts`

```ts
/**
 * ONEWMS shop_id / trans_corp / supply_code 부트스트랩.
 *
 * 실행:
 *   pnpm tsx scripts/onewms-bootstrap-shop.ts
 *
 * 출력: 모든 사용자정의 판매처 / 택배사 / 공급처 코드를 콘솔에 표시.
 * 사용자가 우리 판매처 코드를 .env.local 의 ONEWMS_SHOP_ID 에 복사.
 */
import { createOnewmsClient } from '@/lib/onewms';

async function main() {
  const client = createOnewmsClient();

  console.log('\n=== 판매처 (set_orders 의 shop_id 후보) ===');
  const shops = await client.getEtcInfo('shop');
  console.table(shops);  // shop_code=usermanual 인 row 가 우리가 사용할 shop_id

  console.log('\n=== 택배사 (set_trans_no 의 trans_corp) ===');
  const trans = await client.getEtcInfo('trans');
  console.table(trans);

  console.log('\n=== 공급처 (add_product 의 supply_code) ===');
  const supplies = await client.getEtcInfo('supply');
  console.table(supplies);

  console.log('\n=== 창고 (warehouse_seq) ===');
  const wh = await client.getEtcInfo('warehouse');
  console.table(wh);

  console.log('\n다음 단계: 위에서 shop_code = "usermanual" 또는 우리 라이브커머스 명의 row 의 shop_id 를 .env.local 의 ONEWMS_SHOP_ID 에 설정.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

---

### Step 7. `orderSync.ts` 의 createOrder 호출부 전면 재작성 (lines 86-96)

#### Before
```ts
const onewmsRequest: CreateOrderRequest = {
  order_no: onewmsOrderNo,
  order_date: order.createdAt.toISOString().slice(0, 10),
  recipient_name: order.recipient,
  recipient_phone: order.phone,
  recipient_address: order.address,
  products: order.items.map((item) => ({
    product_code: item.product.onewmsCode!,
    quantity: item.quantity,
  })),
};
```

#### After
```ts
import { getOnewmsConfig } from '@/lib/onewms/config';

const config = getOnewmsConfig();  // throws if shop_id missing

const today = new Date().toISOString().slice(0, 10);
const collectDate = order.createdAt.toISOString().slice(2, 10);  // YY-MM-DD

const rows: CreateOrderRow[] = order.items.map((item, idx) => ({
  order_id: onewmsOrderNo,                              // 주문 단위 식별 (같은 발주 = 같은 order_id)
  order_id_seq: `${onewmsOrderNo}-${idx + 1}`,          // 아이템 단위 식별
  shop_product_id: item.product.onewmsCode!,            // 필수 (검증 위에서 통과)
  product_name: item.product.name,
  qty: item.quantity,
  recv_name: order.recipient,                           // 필수
  recv_mobile: order.phone,
  recv_address: order.address,
  order_name: order.recipient,                          // 동일 인물 가정 (분리 필드 있으면 교체)
  order_mobile: order.phone,
  order_date: today,
  memo: order.memo ?? undefined,
  trans_who: '선불',
}));

const onewmsRequest: CreateOrderRequest = {
  shop_id: config.shopId,
  collect_date: collectDate,
  rows,
};
```

⚠️ `order.memo` 필드가 스키마에 있는지 확인. 없으면 omit. `Order.recipient` 가 null 가능하면 위 validate 에서 한 번 더 가드.

---

### Step 8. `deliverySync.ts:88-98` 수정

#### Before
```ts
const orderList = await client.getOrderInfo({
  date_type: 'order_date',
  start_date: thirtyDaysAgo,
  end_date: today,
  order_no: mapping.onewmsOrderNo,      // ❌ 존재하지 않는 파라미터
});

const orderInfo = orderList.find(
  (o) => o.order_no === mapping.onewmsOrderNo || o.order_id === mapping.onewmsOrderNo
) || orderList[0];
```

#### After
```ts
const orderList = await client.getOrderInfo({
  date_type: 'order_date',
  start_date: thirtyDaysAgo,
  end_date: today,
  order_id: mapping.onewmsOrderNo,      // ✅ 우리가 set_orders 에 넣은 order_id 가 곧 onewmsOrderNo
});

const orderInfo = orderList.find(
  (o) => o.order_id === mapping.onewmsOrderNo
) || orderList[0];
```

---

### Step 9. 검증

#### 9-1. 컴파일/린트
```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```
→ 모두 통과해야 함. 타입 변경 영향으로 깨지는 곳 발견 시 모두 수정.

#### 9-2. 단위 점검
- `lib/onewms/example.ts` 가 있다면 신규 타입 기준으로 갱신
- 타입 불일치로 인한 영향 grep:
  ```bash
  rg "order_no:|recipient_name:|recipient_phone:|recipient_address:" lib app
  ```

#### 9-3. 부트스트랩 실행 (사용자 환경)
```bash
pnpm tsx scripts/onewms-bootstrap-shop.ts
```
- 출력 확인 → `.env.local` 의 `ONEWMS_SHOP_ID` 채움
- 채우지 않은 상태에서 `syncOrderToOnewms` 호출 시 명확한 에러 메시지 떠야 함

#### 9-4. 실제 sync 테스트 (사용자 단계, 코드 작성 후)
1. 테스트 발주 1건 생성 (상품 1~2개 포함, 모두 `onewmsCode` 있음)
2. 컨펌 → `syncOrderToOnewms` 호출
3. 응답 `error===0` 확인
4. ONEWMS 운영자 화면에서 주문 보임 확인
5. 실패 시 `OnewmsOrderMapping.errorMessage` 의 msg 가 공식 에러 형태인지 확인 (Invalid order_id 등)

---

## 3. 산출물 (Claude Code 가 제출해야 할 것)

작업 완료 후 다음을 출력:

1. **변경된 파일 목록** (path:line)
2. **각 파일의 핵심 diff** (>30줄이면 요약 + 핵심 hunk)
3. **타입체크/린트/빌드 결과** (스크린샷 또는 로그)
4. **부트스트랩 스크립트 실행 결과 예시 (목업 OK — 실제 ONEWMS 키 없이는 못 돌릴 수 있음)**
5. **남은 작업 (P1) 목록** — 본 핫픽스에서 안 건드린 항목
6. **롤백 가이드** — 문제 시 어느 커밋 revert

---

## 4. 절대 하지 말 것 (보리스 원칙 #5 학습)

- ❌ 운영 사이드바 라우팅 확인 없이 `/admin/...` 경로 만들기
- ❌ Prisma 마이그레이션을 샌드박스에서 실행 (사용자 로컬에서 돌려야 함)
- ❌ NextAuth (`app/api/auth/`) 건드리기
- ❌ "검증 100% PASS" 만 보고 운영 동선 검증 누락 (보리스 #5 / 학습 #8)
- ❌ Playwright 가 통과했다고 시드 1~2건만으로 안심하기 (학습 #10)
- ❌ env 파일 (`.env.local`) 을 git 에 커밋

---

## 5. 보고 형식

작업 후 다음 형식으로 PM 에게 보고:

```
## ONEWMS P0 핫픽스 완료 보고

### 변경 요약
- 파일 N개 수정 / M개 신규 / 0개 삭제
- 타입체크: PASS / 빌드: PASS / 린트: PASS (또는 N 개 warning)

### 핵심 변경
1. [types.ts] CreateOrderRequest 재정의 — JSON 배열 + shop_id 필수
2. [client.ts] getOrderInfo order_no 제거, createOrder JSON.stringify 처리
3. [config.ts] shop_id 환경변수 + 가드
4. [orderSync.ts] Order → set_orders 매핑 전면 재작성
5. [deliverySync.ts] order_no → order_id
6. [.env.example] ONEWMS_SHOP_ID 추가
7. [scripts/onewms-bootstrap-shop.ts] 신규

### 남은 작업
- (P1) set_trans_pos / cancel_trans_pos / set_order_label / add_product 필드명 정리
- (P1) add_sheet / get_onedas_* 필드명 정리
- (운영) shop_id 부트스트랩 실행 후 .env.local 설정

### 의문 사항
- set_orders 의 JSON 배열을 어떤 키로 form-encode 해서 보내는지 ONEWMS 측 확인 필요 (data / orders / rows 중)
- order.memo 컬럼 존재 여부
```

---

## 6. 참고
- 학습 #9: API 응답 구조 `{data: T}` 래퍼 항상 확인
- 학습 #10: 목록 API 는 페이지네이션부터
- 보리스 #4: Plan 먼저, 코드 나중
- 보리스 #5: 실수는 CLAUDE.md 에 기록

---

끝.
