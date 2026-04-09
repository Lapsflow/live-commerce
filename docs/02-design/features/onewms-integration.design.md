# ONEWMS-FMS API 통합 설계서

**작성일**: 2026-04-09
**프로젝트**: Live Commerce Platform
**기능**: ONEWMS-FMS API Integration

---

## 1. 아키텍처 설계

### 1.1 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                 Live Commerce Platform                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐      ┌──────────────┐                  │
│  │ Order API   │─────▶│ ONEWMS Queue │                  │
│  └─────────────┘      └──────┬───────┘                  │
│                              │                            │
│  ┌─────────────┐      ┌──────▼───────┐                  │
│  │ Stock Sync  │◀────▶│ ONEWMS Client│                  │
│  │ Cron Job    │      │  (lib/onewms) │                  │
│  └─────────────┘      └──────┬───────┘                  │
│                              │                            │
│  ┌─────────────┐      ┌──────▼───────┐                  │
│  │ Delivery    │◀────▶│ Background   │                  │
│  │ Tracker     │      │ Worker       │                  │
│  └─────────────┘      └──────────────┘                  │
│                              │                            │
└──────────────────────────────┼────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  ONEWMS-FMS API  │
                    │ api.onewms.co.kr │
                    └──────────────────┘
```

### 1.2 데이터 흐름

```
[주문 생성 플로우]
User Order → Check Stock (ONEWMS) → Create Order (Local DB)
         → Send to ONEWMS → Update Mapping → Return Success

[재고 동기화 플로우]
Cron Job → Get Stock Info (ONEWMS) → Update Products (Local DB)
        → Check Low Stock → Send Alert → Log History

[배송 추적 플로우]
Cron Job → Get Order Status (ONEWMS) → Update Orders (Local DB)
        → Notify Customer → Log Status Change
```

---

## 2. 데이터베이스 설계

### 2.1 신규 테이블

#### OnewmsOrderMapping
주문과 ONEWMS 주문 번호 매핑

```prisma
model OnewmsOrderMapping {
  id              String    @id @default(cuid())
  orderId         String    @unique
  order           Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)

  onewmsOrderNo   String    @unique  // ONEWMS 주문번호
  transNo         String?              // 송장번호

  status          String    @default("pending")  // pending, sent, shipped, failed
  csStatus        Int       @default(0)          // ONEWMS CS상태
  holdStatus      Int       @default(0)          // ONEWMS 보류상태

  sentAt          DateTime?             // ONEWMS 전송 시각
  lastSyncAt      DateTime?             // 마지막 동기화 시각
  errorMessage    String?               // 에러 메시지
  retryCount      Int       @default(0) // 재시도 횟수

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([onewmsOrderNo])
  @@index([status])
  @@index([sentAt])
}
```

#### OnewmsStockSync
재고 동기화 히스토리

```prisma
model OnewmsStockSync {
  id              String    @id @default(cuid())
  productId       String
  product         Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  productCode     String               // ONEWMS 상품코드
  availableQty    Int                  // ONEWMS 가용재고
  totalQty        Int                  // ONEWMS 총재고
  localQty        Int                  // 플랫폼 재고

  difference      Int                  // 차이 (ONEWMS - Local)
  syncStatus      String    @default("synced")  // synced, conflict, failed

  syncedAt        DateTime  @default(now())

  @@index([productId])
  @@index([syncedAt])
}
```

#### OnewmsDeliveryLog
배송 상태 변경 로그

```prisma
model OnewmsDeliveryLog {
  id              String    @id @default(cuid())
  orderId         String
  order           Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)

  oldStatus       String?              // 이전 배송 상태
  newStatus       String               // 새로운 배송 상태
  transNo         String?              // 송장번호

  changedAt       DateTime  @default(now())
  syncedFrom      String    @default("onewms")  // onewms, manual, system

  @@index([orderId])
  @@index([changedAt])
}
```

### 2.2 기존 테이블 수정

#### Product 테이블에 필드 추가

```prisma
model Product {
  // ... existing fields ...

  onewmsCode      String?   @unique      // ONEWMS 상품코드
  onewmsBarcode   String?                // ONEWMS 바코드

  stockSyncs      OnewmsStockSync[]
}
```

#### Order 테이블에 필드 추가

```prisma
model Order {
  // ... existing fields ...

  onewmsMapping   OnewmsOrderMapping?
  deliveryLogs    OnewmsDeliveryLog[]
}
```

---

## 3. API 설계

### 3.1 주문 관련 API

#### POST /api/onewms/orders
ONEWMS에 주문 전송

**Request:**
```typescript
{
  orderId: string;          // 플랫폼 주문 ID
  forceResend?: boolean;    // 강제 재전송 여부
}
```

**Response:**
```typescript
{
  success: boolean;
  onewmsOrderNo: string;
  message?: string;
}
```

**로직:**
1. 주문 정보 조회
2. 재고 확인 (각 상품별)
3. ONEWMS 주문 생성
4. OnewmsOrderMapping 저장
5. 주문 상태 업데이트

---

#### GET /api/onewms/orders/:orderId
ONEWMS 주문 정보 조회

**Response:**
```typescript
{
  onewmsOrderNo: string;
  status: string;
  transNo?: string;
  csStatus: number;
  holdStatus: number;
  lastSyncAt: string;
}
```

---

### 3.2 재고 관련 API

#### POST /api/onewms/stock/sync
재고 동기화 (수동)

**Request:**
```typescript
{
  productId?: string;  // 특정 상품만 동기화 (없으면 전체)
}
```

**Response:**
```typescript
{
  success: boolean;
  syncedCount: number;
  conflicts: Array<{
    productId: string;
    localQty: number;
    onewmsQty: number;
    difference: number;
  }>;
}
```

**로직:**
1. 상품 목록 조회 (onewmsCode가 있는 것만)
2. ONEWMS에서 재고 조회 (병렬 처리)
3. 차이 계산 및 로그 저장
4. 재고 자동 업데이트 (옵션)
5. 충돌 목록 반환

---

#### GET /api/onewms/stock/:productId
특정 상품 재고 조회

**Response:**
```typescript
{
  productId: string;
  productCode: string;
  localQty: number;
  onewmsQty: {
    available: number;
    total: number;
  };
  lastSyncAt: string;
}
```

---

### 3.3 배송 관련 API

#### POST /api/onewms/delivery/update
배송 상태 업데이트

**Request:**
```typescript
{
  orderId: string;
  action: 'set_trans_pos' | 'cancel_trans_pos';
}
```

**Response:**
```typescript
{
  success: boolean;
  newStatus: string;
  transNo?: string;
}
```

---

#### GET /api/onewms/delivery/invoice/:transNo
송장 이미지 URL 조회

**Response:**
```typescript
{
  transNo: string;
  invoiceUrl: string;
}
```

---

### 3.4 관리자 API

#### GET /api/admin/onewms/status
ONEWMS 연동 상태 조회

**Response:**
```typescript
{
  isConnected: boolean;
  lastSyncAt: string;
  stats: {
    totalOrders: number;
    pendingOrders: number;
    failedOrders: number;
    syncedProducts: number;
    lowStockProducts: number;
  };
  recentErrors: Array<{
    timestamp: string;
    type: string;
    message: string;
  }>;
}
```

---

#### POST /api/admin/onewms/retry-failed
실패한 주문 재시도

**Request:**
```typescript
{
  orderIds?: string[];  // 특정 주문만 (없으면 전체 실패 주문)
}
```

**Response:**
```typescript
{
  totalRetried: number;
  succeeded: number;
  failed: number;
  results: Array<{
    orderId: string;
    success: boolean;
    error?: string;
  }>;
}
```

---

## 4. 백그라운드 작업 설계

### 4.1 재고 동기화 Cron

**파일**: `lib/cron/stock-sync.ts`

**스케줄**: `*/5 * * * *` (5분마다)

**로직**:
```typescript
async function syncStock() {
  // 1. ONEWMS 코드가 있는 모든 상품 조회
  const products = await prisma.product.findMany({
    where: { onewmsCode: { not: null } }
  });

  // 2. 병렬로 재고 조회 (최대 10개씩)
  const chunks = chunkArray(products, 10);
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (product) => {
        const stock = await onewmsClient.getStockInfo(product.onewmsCode);

        // 3. 차이 계산
        const difference = stock.available_qty - product.stock;

        // 4. 로그 저장
        await prisma.onewmsStockSync.create({
          data: {
            productId: product.id,
            productCode: product.onewmsCode,
            availableQty: stock.available_qty,
            totalQty: stock.total_qty,
            localQty: product.stock,
            difference,
            syncStatus: Math.abs(difference) > 5 ? 'conflict' : 'synced'
          }
        });

        // 5. 자동 업데이트 (차이가 크지 않으면)
        if (Math.abs(difference) <= 5) {
          await prisma.product.update({
            where: { id: product.id },
            data: { stock: stock.available_qty }
          });
        }

        // 6. 재고 부족 알림
        if (stock.available_qty < 10) {
          await sendLowStockAlert(product);
        }
      })
    );
  }
}
```

---

### 4.2 배송 상태 업데이트 Cron

**파일**: `lib/cron/delivery-update.ts`

**스케줄**: `*/10 * * * *` (10분마다)

**로직**:
```typescript
async function updateDeliveryStatus() {
  // 1. 배송 대기 중인 주문 조회
  const orders = await prisma.order.findMany({
    where: {
      status: 'PROCESSING',
      onewmsMapping: { isNot: null }
    },
    include: { onewmsMapping: true }
  });

  // 2. ONEWMS에서 상태 조회
  for (const order of orders) {
    const onewmsOrder = await onewmsClient.getOrderInfo(
      order.onewmsMapping.onewmsOrderNo
    );

    // 3. 상태 변경 감지
    const oldStatus = order.status;
    let newStatus = oldStatus;

    if (onewmsOrder.order_status === OrderStatus.SHIPPED) {
      newStatus = 'SHIPPED';
    }

    // 4. 변경사항 있으면 업데이트
    if (oldStatus !== newStatus) {
      await prisma.$transaction([
        // 주문 상태 업데이트
        prisma.order.update({
          where: { id: order.id },
          data: { status: newStatus }
        }),

        // 로그 저장
        prisma.onewmsDeliveryLog.create({
          data: {
            orderId: order.id,
            oldStatus,
            newStatus,
            transNo: order.onewmsMapping.transNo
          }
        }),

        // 매핑 정보 업데이트
        prisma.onewmsOrderMapping.update({
          where: { id: order.onewmsMapping.id },
          data: {
            status: newStatus.toLowerCase(),
            csStatus: onewmsOrder.cs_status,
            holdStatus: onewmsOrder.hold_status,
            lastSyncAt: new Date()
          }
        })
      ]);

      // 5. 고객 알림 발송
      if (newStatus === 'SHIPPED') {
        await sendShippingNotification(order);
      }
    }
  }
}
```

---

### 4.3 주문 처리 Queue

**파일**: `lib/queue/onewms-order-queue.ts`

**용도**: 대량 주문 처리 (라이브 방송 종료 시)

**로직**:
```typescript
interface OrderJob {
  orderId: string;
  retryCount: number;
}

const orderQueue = new Queue<OrderJob>('onewms-orders', {
  concurrency: 5,  // 동시 처리 5개
  retries: 3       // 실패 시 3회 재시도
});

orderQueue.process(async (job) => {
  const { orderId } = job.data;

  try {
    // 1. 주문 정보 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } }
    });

    // 2. 재고 확인
    for (const item of order.items) {
      if (!item.product.onewmsCode) {
        throw new Error(`Product ${item.productId} has no ONEWMS code`);
      }

      const stock = await onewmsClient.getStockInfo(item.product.onewmsCode);
      if (stock.available_qty < item.quantity) {
        throw new Error(`Insufficient stock for ${item.product.name}`);
      }
    }

    // 3. ONEWMS 주문 생성
    const onewmsOrderNo = `LC-${Date.now()}-${orderId}`;
    await onewmsClient.createOrder({
      order_no: onewmsOrderNo,
      order_date: new Date().toISOString().split('T')[0],
      recipient_name: order.recipientName,
      recipient_phone: order.recipientPhone,
      recipient_address: order.recipientAddress,
      products: order.items.map(item => ({
        product_code: item.product.onewmsCode,
        quantity: item.quantity
      }))
    });

    // 4. 매핑 정보 저장
    await prisma.onewmsOrderMapping.create({
      data: {
        orderId: order.id,
        onewmsOrderNo,
        status: 'sent',
        sentAt: new Date()
      }
    });

    return { success: true, onewmsOrderNo };
  } catch (error) {
    // 에러 로깅
    await prisma.onewmsOrderMapping.update({
      where: { orderId },
      data: {
        status: 'failed',
        errorMessage: error.message,
        retryCount: { increment: 1 }
      }
    });

    throw error;  // 재시도를 위해 throw
  }
});
```

---

## 5. 주요 컴포넌트 설계

### 5.1 ONEWMS Config 초기화

**파일**: `lib/onewms/init.ts`

```typescript
import { setOnewmsConfig } from './index';

export function initializeOnewms() {
  if (!process.env.ONEWMS_PARTNER_KEY || !process.env.ONEWMS_DOMAIN_KEY) {
    console.warn('ONEWMS configuration missing, skipping initialization');
    return;
  }

  setOnewmsConfig({
    partnerKey: process.env.ONEWMS_PARTNER_KEY,
    domainKey: process.env.ONEWMS_DOMAIN_KEY,
    apiUrl: process.env.ONEWMS_API_URL
  });

  console.log('ONEWMS client initialized');
}
```

---

### 5.2 주문 전송 헬퍼

**파일**: `lib/onewms/helpers/order-sender.ts`

```typescript
import { createOnewmsClient } from '../index';
import { prisma } from '@/lib/db/prisma';

export async function sendOrderToOnewms(orderId: string) {
  const client = createOnewmsClient();

  // 1. 주문 조회
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      onewmsMapping: true
    }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // 2. 이미 전송된 주문인지 확인
  if (order.onewmsMapping && order.onewmsMapping.status === 'sent') {
    return {
      success: true,
      onewmsOrderNo: order.onewmsMapping.onewmsOrderNo,
      message: 'Already sent'
    };
  }

  // 3. 재고 확인
  const stockCheck = await checkStockAvailability(order.items);
  if (!stockCheck.available) {
    throw new Error(`Insufficient stock: ${stockCheck.message}`);
  }

  // 4. ONEWMS 주문 생성
  const onewmsOrderNo = generateOnewmsOrderNo(order.id);

  await client.createOrder({
    order_no: onewmsOrderNo,
    order_date: order.createdAt.toISOString().split('T')[0],
    recipient_name: order.recipientName || '',
    recipient_phone: order.recipientPhone || '',
    recipient_address: order.recipientAddress || '',
    products: order.items.map(item => ({
      product_code: item.product.onewmsCode || '',
      quantity: item.quantity
    }))
  });

  // 5. 매핑 정보 저장
  await prisma.onewmsOrderMapping.upsert({
    where: { orderId },
    create: {
      orderId,
      onewmsOrderNo,
      status: 'sent',
      sentAt: new Date()
    },
    update: {
      onewmsOrderNo,
      status: 'sent',
      sentAt: new Date(),
      errorMessage: null
    }
  });

  return {
    success: true,
    onewmsOrderNo
  };
}

async function checkStockAvailability(items: any[]) {
  const client = createOnewmsClient();

  for (const item of items) {
    if (!item.product.onewmsCode) {
      return {
        available: false,
        message: `Product ${item.product.name} has no ONEWMS code`
      };
    }

    const stock = await client.getStockInfo(item.product.onewmsCode);
    if (!stock.available_qty || stock.available_qty < item.quantity) {
      return {
        available: false,
        message: `Insufficient stock for ${item.product.name}`
      };
    }
  }

  return { available: true };
}

function generateOnewmsOrderNo(orderId: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `LC-${timestamp}-${orderId.slice(0, 8)}-${random}`;
}
```

---

### 5.3 재고 동기화 헬퍼

**파일**: `lib/onewms/helpers/stock-syncer.ts`

```typescript
import { createOnewmsClient } from '../index';
import { prisma } from '@/lib/db/prisma';

export async function syncProductStock(productId?: string) {
  const client = createOnewmsClient();

  // 1. 상품 조회
  const products = await prisma.product.findMany({
    where: productId ? { id: productId } : { onewmsCode: { not: null } }
  });

  const results = {
    syncedCount: 0,
    conflicts: [] as any[]
  };

  // 2. 각 상품 재고 동기화
  for (const product of products) {
    try {
      const stock = await client.getStockInfo(product.onewmsCode!);

      const difference = stock.available_qty! - product.stock;
      const syncStatus = Math.abs(difference) > 5 ? 'conflict' : 'synced';

      // 3. 로그 저장
      await prisma.onewmsStockSync.create({
        data: {
          productId: product.id,
          productCode: product.onewmsCode!,
          availableQty: stock.available_qty!,
          totalQty: stock.total_qty || 0,
          localQty: product.stock,
          difference,
          syncStatus
        }
      });

      // 4. 자동 업데이트 (충돌이 없으면)
      if (syncStatus === 'synced') {
        await prisma.product.update({
          where: { id: product.id },
          data: { stock: stock.available_qty }
        });
        results.syncedCount++;
      } else {
        results.conflicts.push({
          productId: product.id,
          productName: product.name,
          localQty: product.stock,
          onewmsQty: stock.available_qty,
          difference
        });
      }
    } catch (error) {
      console.error(`Failed to sync stock for product ${product.id}:`, error);
    }
  }

  return results;
}
```

---

## 6. UI 설계

### 6.1 관리자 대시보드 - ONEWMS 상태 위젯

**파일**: `app/(main)/admin/dashboard/components/onewms-status-widget.tsx`

**기능**:
- ONEWMS 연동 상태 표시
- 대기 중인 주문 수
- 최근 동기화 시간
- 재고 충돌 알림
- 실패한 주문 목록

**UI 구조**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>ONEWMS 연동 상태</CardTitle>
    <Badge variant={isConnected ? 'success' : 'error'}>
      {isConnected ? '연결됨' : '연결 끊김'}
    </Badge>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="대기 주문" value={pendingOrders} />
        <StatCard label="실패 주문" value={failedOrders} />
        <StatCard label="재고 충돌" value={conflicts} />
      </div>

      {/* 마지막 동기화 */}
      <div className="text-sm text-muted-foreground">
        마지막 동기화: {lastSyncAt}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <Button onClick={handleSyncStock}>재고 동기화</Button>
        <Button onClick={handleRetryFailed}>실패 재시도</Button>
      </div>
    </div>
  </CardContent>
</Card>
```

---

### 6.2 주문 상세 페이지 - ONEWMS 정보

**파일**: `app/(main)/orders/[id]/components/onewms-info.tsx`

**기능**:
- ONEWMS 주문번호 표시
- 송장번호 및 배송 상태
- ONEWMS로 재전송 버튼
- 송장 이미지 보기

---

### 6.3 상품 관리 - 재고 동기화

**파일**: `app/(main)/products/components/stock-sync-button.tsx`

**기능**:
- 개별 상품 재고 동기화
- ONEWMS 재고 vs 플랫폼 재고 비교
- 수동 재고 조정

---

## 7. 에러 처리 및 로깅

### 7.1 에러 처리 전략

```typescript
// ONEWMS API 에러 핸들러
export async function handleOnewmsError(
  error: any,
  context: {
    action: string;
    orderId?: string;
    productId?: string;
  }
) {
  // 1. 에러 타입 확인
  if (error instanceof OnewmsApiError) {
    // API 에러 코드별 처리
    switch (error.code) {
      case 1:  // 배송전 전체 취소
      case 2:  // 배송전 부분 취소
        await handleOrderCancellation(context.orderId!);
        break;

      case 3:  // 배송후 전체 취소
      case 4:  // 배송후 부분 취소
        await handleReturnRequest(context.orderId!);
        break;

      default:
        // 일반 에러 로깅
        await logOnewmsError(error, context);
    }
  }

  // 2. 재시도 가능 여부 판단
  const shouldRetry = isRetryableError(error);

  if (shouldRetry && context.orderId) {
    await scheduleRetry(context.orderId);
  }

  // 3. 관리자 알림
  if (error.code >= 3) {
    await sendAdminAlert({
      type: 'onewms_error',
      message: error.message,
      context
    });
  }
}

function isRetryableError(error: any): boolean {
  // 네트워크 에러, 타임아웃 등은 재시도 가능
  return error.code === -1 || error.message.includes('timeout');
}
```

---

### 7.2 로깅 전략

```typescript
// ONEWMS 작업 로깅
export async function logOnewmsAction(
  action: string,
  data: any,
  result: { success: boolean; error?: string }
) {
  await prisma.onewmsLog.create({
    data: {
      action,
      requestData: JSON.stringify(data),
      responseData: JSON.stringify(result),
      success: result.success,
      errorMessage: result.error,
      timestamp: new Date()
    }
  });
}
```

---

## 8. 테스트 계획

### 8.1 단위 테스트

- **ONEWMS Client**: 모든 API 메서드 테스트
- **주문 전송 헬퍼**: 재고 확인, 주문 생성 로직
- **재고 동기화**: 차이 계산, 충돌 감지

### 8.2 통합 테스트

- **주문 플로우**: 주문 생성 → ONEWMS 전송 → 상태 업데이트
- **재고 동기화**: 크론 작업 → 재고 업데이트 → 알림 발송
- **배송 추적**: 배송 상태 조회 → DB 업데이트 → 고객 알림

### 8.3 E2E 테스트

- 라이브 방송 종료 후 대량 주문 처리
- ONEWMS API 장애 시나리오
- 재고 부족 시나리오

---

## 9. 성능 최적화

### 9.1 배치 처리

```typescript
// 대량 주문 처리 시 배치 단위로 처리
const BATCH_SIZE = 10;

async function processBatchOrders(orderIds: string[]) {
  const batches = chunkArray(orderIds, BATCH_SIZE);

  for (const batch of batches) {
    await Promise.all(
      batch.map(orderId => orderQueue.add({ orderId, retryCount: 0 }))
    );

    // 배치 간 딜레이 (API 과부하 방지)
    await sleep(1000);
  }
}
```

### 9.2 캐싱

```typescript
// 재고 정보 캐싱 (5분)
import NodeCache from 'node-cache';

const stockCache = new NodeCache({ stdTTL: 300 });

async function getCachedStock(productCode: string) {
  const cached = stockCache.get<StockInfo>(productCode);
  if (cached) return cached;

  const stock = await onewmsClient.getStockInfo(productCode);
  stockCache.set(productCode, stock);

  return stock;
}
```

---

## 10. 보안 고려사항

### 10.1 API 키 관리

- 환경 변수로 관리 (.env)
- 프로덕션 환경은 별도 키 사용
- 키 로테이션 계획 (분기별)

### 10.2 API 호출 제한

```typescript
// Rate limiting
import rateLimit from 'express-rate-limit';

const onewmsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1분
  max: 100                   // 최대 100회
});

app.use('/api/onewms', onewmsLimiter);
```

### 10.3 데이터 검증

```typescript
// 주문 데이터 검증
import { z } from 'zod';

const orderSchema = z.object({
  order_no: z.string().min(1).max(50),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recipient_name: z.string().min(1),
  recipient_phone: z.string().regex(/^01[0-9]-\d{3,4}-\d{4}$/),
  products: z.array(z.object({
    product_code: z.string(),
    quantity: z.number().positive()
  }))
});
```

---

## 11. 마이그레이션 계획

### 11.1 기존 주문 처리

- 기존 주문은 ONEWMS 전송 대상에서 제외
- 특정 날짜 이후 주문만 자동 전송
- 수동 전송 옵션 제공

### 11.2 상품 코드 매핑

```sql
-- 기존 상품에 ONEWMS 코드 추가
UPDATE products
SET onewms_code = CASE
  WHEN sku = 'PROD-001' THEN 'ONEWMS-PROD-001'
  WHEN sku = 'PROD-002' THEN 'ONEWMS-PROD-002'
  -- ... more mappings
END
WHERE sku IN ('PROD-001', 'PROD-002', ...);
```

### 11.3 단계적 배포

1. **Phase 1**: ONEWMS 클라이언트 라이브러리 배포 (완료)
2. **Phase 2**: DB 스키마 마이그레이션
3. **Phase 3**: 재고 동기화 크론 활성화
4. **Phase 4**: 주문 전송 기능 활성화 (일부 상품만)
5. **Phase 5**: 전체 상품 활성화
6. **Phase 6**: 배송 추적 활성화

---

## 12. 모니터링 및 알림

### 12.1 모니터링 지표

- API 호출 성공률
- 평균 응답 시간
- 재고 동기화 주기
- 주문 전송 실패율

### 12.2 알림 설정

```typescript
// 알림 트리거
enum AlertType {
  API_FAILURE = 'api_failure',
  LOW_STOCK = 'low_stock',
  SYNC_FAILURE = 'sync_failure',
  HIGH_ERROR_RATE = 'high_error_rate'
}

async function sendAlert(type: AlertType, data: any) {
  // Slack, Email 등으로 알림 발송
  await notificationService.send({
    channel: '#onewms-alerts',
    message: `[${type}] ${data.message}`,
    data
  });
}
```

---

## 13. 구현 체크리스트

### Phase 1: DB 스키마
- [ ] Prisma 스키마 업데이트
- [ ] 마이그레이션 파일 생성
- [ ] 마이그레이션 실행 및 검증

### Phase 2: 주문 통합
- [ ] POST /api/onewms/orders 구현
- [ ] 주문 전송 헬퍼 구현
- [ ] Queue 시스템 구현
- [ ] 에러 핸들링

### Phase 3: 재고 동기화
- [ ] POST /api/onewms/stock/sync 구현
- [ ] 크론 작업 구현
- [ ] 재고 충돌 처리
- [ ] 알림 시스템

### Phase 4: 배송 추적
- [ ] 배송 상태 업데이트 크론
- [ ] 송장 이미지 조회 API
- [ ] 고객 알림 발송

### Phase 5: 관리자 UI
- [ ] ONEWMS 상태 위젯
- [ ] 주문 상세 ONEWMS 정보
- [ ] 재고 동기화 버튼
- [ ] 실패 주문 재시도

### Phase 6: 테스트
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성
- [ ] E2E 테스트 시나리오
- [ ] 성능 테스트

---

## 14. 참고 자료

- ONEWMS API 문서: https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f
- 클라이언트 라이브러리: `/lib/onewms/`
- 계획서: `/docs/01-plan/features/onewms-integration.plan.md`
