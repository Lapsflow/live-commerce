# ONEWMS-FMS API 통합 설계서

**작성일**: 2026-04-09
**최종 수정**: 2026-04-12 (100% 완료)
**프로젝트**: Live Commerce Platform
**기능**: ONEWMS-FMS API Integration
**상태**: ✅ **구현 완료 (100%)**

---

## 🎯 구현 현황 요약 (2026-04-12 기준)

### ✅ 완료된 구현 (100%)

**데이터베이스 & 스키마**
- ✅ OnewmsOrderMapping, OnewmsStockSync, OnewmsDeliveryLog 모델
- ✅ Product 모델 ONEWMS 필드 (onewmsCode, onewmsBarcode)
- ✅ 다중 창고 시스템 통합 (Warehouse, BarcodeMaster, WarehouseInventory, StockMovement)

**백엔드 서비스 & Cron**
- ✅ `lib/services/onewms/stockSync.ts` - 재고 동기화 서비스
  - syncAllStocks(), syncProductStock(), getStockConflicts(), resolveConflict()
  - 배치 처리 (5개씩 병렬), 자동 충돌 해결 (차이 < 5)
- ✅ `lib/services/onewms/orderSync.ts` - 주문 동기화 서비스
- ✅ `lib/services/onewms/deliverySync.ts` - 배송 동기화 서비스
- ✅ `lib/services/onewms/notifications.ts` - 알림 서비스
- ✅ `app/api/cron/stock-sync/route.ts` - 재고 동기화 Cron (6시간마다)
- ✅ `app/api/cron/delivery-sync/route.ts` - 배송 동기화 Cron (10분마다)
- ✅ `app/api/cron/warehouse-sync/route.ts` - 다중 창고 동기화 Cron (매일 09:00 KST)

**REST API 엔드포인트** (10/10 완료 ✅)
- ✅ POST /api/onewms/orders/sync - 주문 ONEWMS 전송
- ✅ GET /api/onewms/orders/[id]/status - 주문 상태 조회
- ✅ POST /api/onewms/orders/retry - 실패 주문 재시도
- ✅ POST /api/onewms/stock/sync - 수동 재고 동기화
- ✅ GET /api/onewms/stock/conflicts - 재고 충돌 목록
- ✅ POST /api/onewms/stock/conflicts/[id]/resolve - 충돌 해결
- ✅ GET /api/onewms/stats - 전체 통계
- ✅ GET /api/onewms/stock/[productId] - 상품별 재고 조회
- ✅ POST /api/onewms/delivery/update - 배송 상태 수동 업데이트
- ✅ GET /api/onewms/delivery/invoice/[transNo] - 송장 이미지 조회

**관리자 UI 컴포넌트** (3/3 완료 ✅)
- ✅ `app/(main)/admin/dashboard/components/onewms-status-widget.tsx` - ONEWMS 상태 대시보드 위젯
- ✅ `app/(main)/orders/[id]/components/onewms-info.tsx` - 주문 상세 ONEWMS 정보
- ✅ `app/(main)/products/components/stock-sync-button.tsx` - 상품 재고 동기화 버튼

### 🎯 향후 개선 사항 (선택사항)

**Queue & 고급 기능** (우선순위 낮음)
- [ ] Queue 시스템 (Bull/BullMQ - 대량 주문 처리용)
- [ ] 실시간 알림 통합 (WebSocket/SSE)
- [ ] 고객 배송 알림 발송 (카카오톡/SMS)
- [ ] ONEWMS Webhook 연동 (Polling → Push 전환)
- [ ] Redis 캐싱 도입 (재고 정보 5분 캐시)

### 📊 최종 진행률

| 구분 | 완료율 | 상태 |
|------|--------|------|
| **데이터베이스** | 100% | ✅ 완료 |
| **백엔드 서비스** | 100% | ✅ 완료 |
| **Cron Jobs** | 100% | ✅ 완료 |
| **REST API** | 100% (10/10) | ✅ 완료 |
| **관리자 UI** | 100% (3/3) | ✅ 완료 |
| **테스트** | 0% | ⏳ 선택사항 |

**전체 ONEWMS 통합 진행률**: ✅ **100% (완료)**

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

**스케줄**: `0 */6 * * *` (6시간마다)

**Note**: 설계서 초안에서는 5분마다 동기화로 계획했으나, 실제 구현에서는 ONEWMS API 부하 및 실제 재고 변동 주기를 고려하여 6시간 주기로 변경되었습니다.

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

## 6. UI 컴포넌트 상세 설계

### 6.1 ONEWMS 상태 대시보드 위젯

**파일**: `app/(main)/admin/dashboard/components/onewms-status-widget.tsx`

**우선순위**: 높음 (관리자 필수 모니터링 도구)

**권한**: MASTER, SUB_MASTER, ADMIN만 접근 가능

**기능 요구사항**:
1. **연동 상태 표시**
   - ONEWMS API 연결 상태 (연결됨/연결 끊김)
   - 마지막 동기화 시간 표시
   - 실시간 상태 갱신 (30초 간격)

2. **통계 표시**
   - 대기 중인 주문 수 (status='pending')
   - 실패한 주문 수 (status='failed')
   - 재고 충돌 수 (syncStatus='conflict')

3. **액션 버튼**
   - 재고 동기화: POST /api/onewms/stock/sync 호출
   - 실패 재시도: POST /api/onewms/orders/retry 호출

**API 연동**:
```typescript
// GET /api/onewms/stats
interface OnewmsStats {
  isConnected: boolean;
  lastSyncAt: string;
  stats: {
    pendingOrders: number;
    failedOrders: number;
    conflictCount: number;
  };
}
```

**컴포넌트 구조**:
```tsx
'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export function OnewmsStatusWidget() {
  // 1. API 호출 (30초마다 자동 갱신)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['onewms-stats'],
    queryFn: async () => {
      const res = await fetch('/api/onewms/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json() as Promise<OnewmsStats>;
    },
    refetchInterval: 30000,
  });

  // 2. 재고 동기화 Mutation
  const syncStockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/stock/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('재고 동기화가 완료되었습니다');
      refetch();
    },
    onError: () => {
      toast.error('재고 동기화에 실패했습니다');
    },
  });

  // 3. 실패 재시도 Mutation
  const retryFailedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/orders/retry', { method: 'POST' });
      if (!res.ok) throw new Error('Retry failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('실패한 주문 재시도가 완료되었습니다');
      refetch();
    },
    onError: () => {
      toast.error('재시도에 실패했습니다');
    },
  });

  if (isLoading) {
    return <Card className="animate-pulse h-[200px]" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>ONEWMS 연동 상태</CardTitle>
        <Badge variant={data?.isConnected ? 'default' : 'destructive'}>
          {data?.isConnected ? '연결됨' : '연결 끊김'}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 통계 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data?.stats.pendingOrders || 0}</div>
              <div className="text-sm text-muted-foreground">대기 주문</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">
                {data?.stats.failedOrders || 0}
              </div>
              <div className="text-sm text-muted-foreground">실패 주문</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {data?.stats.conflictCount || 0}
              </div>
              <div className="text-sm text-muted-foreground">재고 충돌</div>
            </div>
          </div>

          {/* 마지막 동기화 */}
          {data?.lastSyncAt && (
            <div className="text-sm text-muted-foreground">
              마지막 동기화:{' '}
              {formatDistanceToNow(new Date(data.lastSyncAt), {
                addSuffix: true,
                locale: ko,
              })}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <Button
              onClick={() => syncStockMutation.mutate()}
              disabled={syncStockMutation.isPending}
              size="sm"
            >
              {syncStockMutation.isPending ? '동기화 중...' : '재고 동기화'}
            </Button>
            <Button
              onClick={() => retryFailedMutation.mutate()}
              disabled={retryFailedMutation.isPending || (data?.stats.failedOrders === 0)}
              variant="outline"
              size="sm"
            >
              {retryFailedMutation.isPending ? '재시도 중...' : '실패 재시도'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**테스트 시나리오**:
1. 위젯이 대시보드에 표시되는지 확인
2. 통계 수치가 정확히 표시되는지 확인
3. 재고 동기화 버튼 클릭 시 동작 확인
4. 실패 재시도 버튼 클릭 시 동작 확인
5. 30초마다 자동 갱신 확인

---

### 6.2 주문 상세 ONEWMS 정보 컴포넌트

**파일**: `app/(main)/orders/[id]/components/onewms-info.tsx`

**우선순위**: 중간

**권한**:
- 모든 역할이 조회 가능
- MASTER, ADMIN만 재전송 버튼 표시

**기능 요구사항**:
1. **ONEWMS 매핑 정보 표시**
   - ONEWMS 주문번호
   - 송장번호 (있는 경우)
   - 전송 상태 (pending/sent/shipped/failed)
   - CS 상태, 보류 상태

2. **관리자 전용 기능**
   - 재전송 버튼: POST /api/onewms/orders/sync
   - 송장 이미지 보기: GET /api/onewms/delivery/invoice/[transNo]

3. **에러 처리**
   - ONEWMS 매핑이 없는 경우 "ONEWMS 전송 전" 표시
   - 실패 상태인 경우 에러 메시지 표시

**API 연동**:
```typescript
// GET /api/onewms/orders/[id]/status
interface OnewmsOrderStatus {
  onewmsOrderNo: string;
  transNo?: string;
  status: 'pending' | 'sent' | 'shipped' | 'failed';
  csStatus: number;
  holdStatus: number;
  sentAt?: string;
  lastSyncAt?: string;
  errorMessage?: string;
}
```

**컴포넌트 구조**:
```tsx
'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

interface OnewmsInfoProps {
  orderId: string;
}

export function OnewmsInfo({ orderId }: OnewmsInfoProps) {
  const { data: session } = useSession();
  const canManage = session?.user?.role === 'MASTER' || session?.user?.role === 'ADMIN';

  // 1. ONEWMS 정보 조회
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['onewms-order', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/onewms/orders/${orderId}/status`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<OnewmsOrderStatus | null>;
    },
  });

  // 2. 재전송 Mutation
  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) throw new Error('Resend failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('ONEWMS 재전송이 완료되었습니다');
      refetch();
    },
    onError: () => {
      toast.error('재전송에 실패했습니다');
    },
  });

  if (isLoading) {
    return <Card className="animate-pulse h-[150px]" />;
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ONEWMS 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">ONEWMS 전송 전</p>
          {canManage && (
            <Button
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              size="sm"
              className="mt-4"
            >
              {resendMutation.isPending ? '전송 중...' : 'ONEWMS 전송'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    shipped: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }[data.status];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>ONEWMS 정보</span>
          <Badge className={statusColor}>{data.status.toUpperCase()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* ONEWMS 주문번호 */}
          <div>
            <div className="text-sm font-medium">ONEWMS 주문번호</div>
            <div className="text-sm text-muted-foreground">{data.onewmsOrderNo}</div>
          </div>

          {/* 송장번호 */}
          {data.transNo && (
            <div>
              <div className="text-sm font-medium">송장번호</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{data.transNo}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    window.open(
                      `/api/onewms/delivery/invoice/${data.transNo}`,
                      '_blank'
                    );
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* CS/보류 상태 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium">CS 상태</div>
              <div className="text-sm text-muted-foreground">{data.csStatus}</div>
            </div>
            <div>
              <div className="text-sm font-medium">보류 상태</div>
              <div className="text-sm text-muted-foreground">{data.holdStatus}</div>
            </div>
          </div>

          {/* 에러 메시지 */}
          {data.errorMessage && (
            <div className="rounded-md bg-red-50 p-3">
              <div className="text-sm font-medium text-red-800">에러</div>
              <div className="text-sm text-red-700">{data.errorMessage}</div>
            </div>
          )}

          {/* 관리자 전용: 재전송 버튼 */}
          {canManage && (
            <Button
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              size="sm"
              variant="outline"
              className="w-full"
            >
              {resendMutation.isPending ? '재전송 중...' : 'ONEWMS 재전송'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**통합 위치**:
`app/(main)/orders/[id]/page.tsx`에 다음과 같이 추가:

```tsx
import { OnewmsInfo } from './components/onewms-info';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  // ... existing code ...

  return (
    <div className="space-y-6">
      {/* Existing order details */}
      <OrderDetailsCard order={order} />

      {/* ONEWMS 정보 추가 */}
      <OnewmsInfo orderId={params.id} />
    </div>
  );
}
```

**테스트 시나리오**:
1. ONEWMS 매핑이 없는 주문 상세 페이지 확인
2. ONEWMS 매핑이 있는 주문 정보 표시 확인
3. 송장번호가 있는 경우 이미지 링크 확인
4. 관리자로 로그인 시 재전송 버튼 표시 확인
5. 실패 상태 주문의 에러 메시지 표시 확인

---

### 6.3 상품 재고 동기화 버튼 컴포넌트

**파일**: `app/(main)/products/components/stock-sync-button.tsx`

**우선순위**: 중간

**권한**: 모든 역할 사용 가능

**기능 요구사항**:
1. **재고 정보 표시**
   - 플랫폼 재고 수량
   - ONEWMS 재고 수량
   - 차이 (있는 경우 강조)

2. **동기화 버튼**
   - POST /api/onewms/stock/sync 호출
   - 로딩 상태 표시
   - 완료 후 toast 알림

3. **충돌 감지**
   - 재고 차이가 5개 이상인 경우 경고 표시
   - 수동 조정 안내

**API 연동**:
```typescript
// GET /api/onewms/stock/[productId]
interface ProductStockInfo {
  productId: string;
  productCode: string;
  localQty: number;
  onewmsQty: {
    available: number;
    total: number;
  };
  lastSyncAt?: string;
  difference: number;
}
```

**컴포넌트 구조**:
```tsx
'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface StockSyncButtonProps {
  productId: string;
}

export function StockSyncButton({ productId }: StockSyncButtonProps) {
  // 1. 재고 정보 조회
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['product-stock', productId],
    queryFn: async () => {
      const res = await fetch(`/api/onewms/stock/${productId}`);
      if (!res.ok) throw new Error('Failed to fetch stock');
      return res.json() as Promise<ProductStockInfo>;
    },
  });

  // 2. 동기화 Mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/stock/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('재고 동기화가 완료되었습니다');
      refetch();
    },
    onError: () => {
      toast.error('재고 동기화에 실패했습니다');
    },
  });

  if (isLoading) {
    return <Button disabled size="sm">로딩 중...</Button>;
  }

  if (!data) {
    return <Button disabled size="sm">ONEWMS 코드 없음</Button>;
  }

  const hasConflict = Math.abs(data.difference) > 5;

  return (
    <div className="space-y-2">
      {/* 재고 정보 */}
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">플랫폼:</span>
          <span className="ml-1 font-medium">{data.localQty}</span>
        </div>
        <div>
          <span className="text-muted-foreground">ONEWMS:</span>
          <span className="ml-1 font-medium">{data.onewmsQty.available}</span>
        </div>
        {data.difference !== 0 && (
          <div className={hasConflict ? 'text-red-600 font-medium' : 'text-yellow-600'}>
            차이: {data.difference > 0 ? '+' : ''}{data.difference}
          </div>
        )}
      </div>

      {/* 충돌 경고 */}
      {hasConflict && (
        <div className="flex items-center gap-2 rounded-md bg-yellow-50 p-2 text-sm text-yellow-800">
          <AlertTriangle className="h-4 w-4" />
          <span>재고 차이가 큽니다. 수동 확인이 필요합니다.</span>
        </div>
      )}

      {/* 동기화 버튼 */}
      <Button
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        size="sm"
        variant="outline"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
        {syncMutation.isPending ? '동기화 중...' : '재고 동기화'}
      </Button>

      {/* 마지막 동기화 */}
      {data.lastSyncAt && (
        <div className="text-xs text-muted-foreground">
          마지막 동기화:{' '}
          {formatDistanceToNow(new Date(data.lastSyncAt), {
            addSuffix: true,
            locale: ko,
          })}
        </div>
      )}
    </div>
  );
}
```

**통합 위치**:
`app/(main)/products/page.tsx` 또는 상품 상세 페이지에 다음과 같이 추가:

```tsx
import { StockSyncButton } from './components/stock-sync-button';

// 상품 목록 테이블에 추가
<TableRow key={product.id}>
  <TableCell>{product.name}</TableCell>
  <TableCell>{product.barcode}</TableCell>
  <TableCell>{product.totalStock}</TableCell>
  <TableCell>
    {product.onewmsCode && (
      <StockSyncButton productId={product.id} />
    )}
  </TableCell>
</TableRow>
```

**테스트 시나리오**:
1. ONEWMS 코드가 있는 상품의 재고 정보 표시 확인
2. 재고 동기화 버튼 클릭 시 동작 확인
3. 재고 차이가 5개 이상인 경우 경고 표시 확인
4. 로딩 상태 애니메이션 확인
5. 동기화 완료 후 toast 알림 확인

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

### Phase 1: DB 스키마 ✅ (100%)
- [x] Prisma 스키마 업데이트
  - OnewmsOrderMapping, OnewmsStockSync, OnewmsDeliveryLog 완료
  - Product 모델에 onewmsCode, onewmsBarcode 필드 추가
- [x] 마이그레이션 파일 생성 및 실행
- [x] 다중 창고 시스템 통합 (Warehouse, BarcodeMaster, WarehouseInventory, StockMovement)

### Phase 2: 주문 통합 ✅ (100%)
- [x] lib/services/onewms/orderSync.ts 서비스 레이어 구현
- [x] POST /api/onewms/orders/sync - ONEWMS 주문 전송
- [x] GET /api/onewms/orders/[id]/status - 주문 정보 조회
- [x] POST /api/onewms/orders/retry - 실패 주문 재시도
- [x] 주문 전송 헬퍼 구현 완료
- [x] 에러 핸들링 및 재시도 로직 완료
- [ ] Queue 시스템 (선택사항 - 대량 주문 처리용)

### Phase 3: 재고 동기화 ✅ (100%)
- [x] lib/services/onewms/stockSync.ts 서비스 레이어 구현
  - syncAllStocks(), syncProductStock(), getStockConflicts(), resolveConflict() 완료
  - 배치 처리 (5개씩 병렬) 및 자동 충돌 해결 (차이 < 5) 구현
- [x] app/api/cron/stock-sync/route.ts 크론 작업 구현 (6시간마다)
- [x] POST /api/onewms/stock/sync - 수동 재고 동기화
- [x] GET /api/onewms/stock/[productId] - 개별 상품 재고 조회
- [x] GET /api/onewms/stock/conflicts - 재고 충돌 목록
- [x] POST /api/onewms/stock/conflicts/[id]/resolve - 충돌 해결
- [x] GET /api/onewms/stats - 전체 통계
- [x] 재고 충돌 감지 및 로깅
- [x] 알림 시스템 (lib/services/onewms/notifications.ts)

### Phase 4: 배송 추적 ✅ (100%)
- [x] lib/services/onewms/deliverySync.ts 서비스 레이어 구현
- [x] app/api/cron/delivery-sync/route.ts 크론 작업 구현 (10분마다)
- [x] POST /api/onewms/delivery/update - 수동 배송 상태 업데이트
- [x] GET /api/onewms/delivery/invoice/[transNo] - 송장 이미지 URL 조회
- [x] 배송 상태 업데이트 로직 완료
- [ ] 고객 알림 발송 통합 (선택사항)

### Phase 5: 관리자 UI ✅ (100% - 완료)
**우선순위**: 최고
- [x] `app/(main)/admin/dashboard/components/onewms-status-widget.tsx`
  - ONEWMS 상태 대시보드 위젯
  - GET /api/onewms/stats 연동
  - 재고 동기화, 실패 재시도 액션
  - 30초 자동 갱신 (React Query refetchInterval)
  - 통합 위치: `app/(main)/admin/dashboard/page.tsx` Line 6, Line 51
- [x] `app/(main)/orders/[id]/components/onewms-info.tsx`
  - 주문 상세 ONEWMS 정보 컴포넌트
  - GET /api/onewms/orders/[id]/status 연동
  - 재전송 버튼 (관리자만 - role check)
  - 송장 이미지 링크 (ExternalLink 아이콘)
  - 통합 위치: `app/(main)/orders/[id]/page.tsx` Line 8, Line 245
- [x] `app/(main)/products/components/stock-sync-button.tsx`
  - 상품 재고 동기화 버튼
  - GET /api/onewms/stock/[productId] 연동
  - 재고 비교 및 충돌 경고 (차이 >5 빨간색, <5 노란색)
  - RefreshCw 스피너 애니메이션

### Phase 6: 테스트 (선택사항)
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성
- [ ] E2E 테스트 시나리오
- [ ] 성능 테스트

---

## 14. 다음 단계 - 관리자 UI 구현

**현재 상태**: REST API 100%, Backend Services 100%, Cron Jobs 100% ✅

**다음 작업**: 관리자 UI 3개 컴포넌트 구현 (4-7시간 예상)

**구현 순서**:
1. **Step 1**: ONEWMS 상태 대시보드 위젯 (2-3시간)
   - 파일 생성: `app/(main)/admin/dashboard/components/onewms-status-widget.tsx`
   - React Query로 GET /api/onewms/stats 호출
   - 통계 카드 UI 구현
   - 재고 동기화, 실패 재시도 버튼 연동
   - 대시보드 페이지에 위젯 추가

2. **Step 2**: 주문 상세 ONEWMS 정보 (1-2시간)
   - 파일 생성: `app/(main)/orders/[id]/components/onewms-info.tsx`
   - ONEWMS 매핑 정보 표시
   - 관리자 권한 체크 후 재전송 버튼 표시
   - 주문 상세 페이지에 컴포넌트 추가

3. **Step 3**: 상품 재고 동기화 버튼 (1-2시간)
   - 파일 생성: `app/(main)/products/components/stock-sync-button.tsx`
   - 재고 비교 정보 표시
   - 충돌 감지 및 경고
   - 상품 목록 또는 상세 페이지에 버튼 추가

**완료 후 진행률**: 100% (ONEWMS 통합 완료) 🎉

---

## 14. 다중 창고 바코드 시스템 통합

### 14.1 통합 아키텍처

ONEWMS 시스템과 다중 창고 바코드 시스템은 공통 재고 관리 기반 위에서 통합됩니다:

```
┌────────────────────────────────────────────────────────────┐
│             Live Commerce Inventory System                 │
├────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────┐          ┌──────────────────┐       │
│   │  ONEWMS System   │          │ Multi-Warehouse  │       │
│   │  (Single WMS)    │          │  Barcode System  │       │
│   └────────┬─────────┘          └────────┬─────────┘       │
│            │                              │                  │
│            ├─ OnewmsStockSync            ├─ WarehouseInventory
│            ├─ OnewmsOrderMapping         ├─ BarcodeMaster  │
│            └─ OnewmsDeliveryLog          └─ StockMovement  │
│                      │                          │            │
│                      ▼                          ▼            │
│              ┌────────────────────────────────────┐         │
│              │      Product (통합 재고)          │         │
│              │  - totalStock (총재고)            │         │
│              │  - onewmsCode (ONEWMS 상품코드)   │         │
│              │  - masterBarcodeId (공식 바코드)  │         │
│              └────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### 14.2 재고 동기화 전략

#### ONEWMS 재고 (단일 WMS)
- **주기**: 6시간마다 자동 동기화
- **소스**: ONEWMS API (`api.onewms.co.kr`)
- **대상**: Product.totalStock
- **충돌 처리**: OnewmsStockSync에 로그 저장, 차이 < 5는 자동 해결

#### 다중 창고 재고 (6개 창고)
- **주기**: 매일 09:00 KST (00:00 UTC)
- **소스**: Google Spreadsheet (각 창고별)
- **대상**: WarehouseInventory (창고별 재고)
- **통합**: 모든 창고 재고 합계

#### 재고 우선순위
1. **공식 바코드 마스터** (BarcodeMaster): 한국무진 독점 관리, 표준 상품 정보
2. **ONEWMS 재고**: 실시간 WMS 재고 (한국무진 통합 WMS)
3. **다중 창고 재고**: 6개 창고 개별 재고의 합계

**재고 불일치 해결 전략**:
- ONEWMS와 다중 창고 시스템이 동시에 존재하는 경우, 관리자 대시보드에서 수동 조정
- WarehouseInventory의 합계와 Product.totalStock 비교
- OnewmsStockSync로 ONEWMS와 Product.totalStock 비교

### 14.3 바코드 매핑

```typescript
// Product 모델의 바코드 관련 필드
interface ProductBarcodes {
  barcode: string;          // 플랫폼 기본 바코드 (unique)
  onewmsBarcode?: string;   // ONEWMS 바코드
  onewmsCode?: string;      // ONEWMS 상품코드 (unique)
  masterBarcodeId?: string; // 공식 바코드 마스터 참조
}
```

**바코드 검색 우선순위**:
1. BarcodeMaster.barcode (공식 바코드)
2. Product.barcode (플랫폼 바코드)
3. Product.onewmsBarcode (ONEWMS 바코드)

### 14.4 Cron Jobs 통합

| Cron Job | 스케줄 | 목적 | 파일 |
|----------|--------|------|------|
| warehouse-sync | `0 0 * * *` (매일 09:00 KST) | 6개 창고 Google Sheets 동기화 | `app/api/cron/warehouse-sync/route.ts` |
| stock-sync | `0 */6 * * *` (6시간마다) | ONEWMS 재고 동기화 | `app/api/cron/stock-sync/route.ts` |
| delivery-sync | `*/10 * * * *` (10분마다) | ONEWMS 배송 상태 동기화 | `app/api/cron/delivery-sync/route.ts` |

**권장 실행 순서**:
1. `warehouse-sync` (매일 09:00) - 창고 재고 최신화
2. `stock-sync` (6시간마다) - ONEWMS 재고 동기화
3. `delivery-sync` (10분마다) - 배송 상태 실시간 추적

### 14.5 관리자 대시보드 통합

관리자 대시보드에 두 시스템 상태를 통합 표시:

```tsx
<DashboardLayout>
  {/* ONEWMS 연동 상태 */}
  <OnewmsStatusWidget
    stats={{
      pendingOrders: number,
      failedOrders: number,
      lastStockSync: Date,
      conflicts: number
    }}
  />

  {/* 다중 창고 바코드 상태 */}
  <WarehouseStatusWidget
    stats={{
      totalWarehouses: 6,
      lastSync: Date,
      totalInventory: number,
      lowStockProducts: number
    }}
  />

  {/* 재고 통합 대시보드 */}
  <InventoryConsolidationWidget
    onewmsTotal: number,
    warehouseTotal: number,
    difference: number
  />
</DashboardLayout>
```

---

## 15. 참고 자료

- ONEWMS API 문서: https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f
- 클라이언트 라이브러리: `/lib/onewms/`
- 계획서: `/docs/01-plan/features/onewms-integration.plan.md`
