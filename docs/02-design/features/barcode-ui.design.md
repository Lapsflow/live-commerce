# Barcode Scanner UI - Design Document

> **Reference**: `docs/01-plan/features/barcode-ui.plan.md`
> **Status**: Design Phase
> **Last Updated**: 2026-04-15

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Design](#component-design)
3. [Data Model](#data-model)
4. [API Specification](#api-specification)
5. [State Management](#state-management)
6. [File Structure](#file-structure)
7. [Implementation Order](#implementation-order)

---

## 🏗️ Architecture Overview

### System Context Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      User (Browser)                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  /inventory/barcode Page                           │     │
│  │  - Camera stream display                           │     │
│  │  - Barcode detection overlay                       │     │
│  │  - Product details modal                           │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                           ↕ HTTP/HTTPS
┌──────────────────────────────────────────────────────────────┐
│                    Next.js App Router                        │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Page Component  │  │  API Routes     │  │   Server    │ │
│  │ (Client)        │→ │  /api/products  │→ │   Actions   │ │
│  │                 │  │  /api/inventory │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────────────┘
                           ↕ Prisma ORM
┌──────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│                                                              │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────┐      │
│  │ Product  │  │ ProductCenter    │  │   ScanLog    │      │
│  │          │  │ Stock            │  │   (NEW)      │      │
│  └──────────┘  └──────────────────┘  └──────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19 + Next.js 16 | UI Framework |
| **Camera** | Browser MediaDevices API | Camera stream |
| **Barcode Detection** | quagga2 v1.8.0 | Barcode scanning |
| **UI Components** | Shadcn/ui | Design system |
| **State** | React Hooks | Local state |
| **API** | Next.js API Routes | Backend endpoints |
| **Database** | Prisma + PostgreSQL | Data persistence |

---

## 🧩 Component Design

### Component Hierarchy

```
app/(main)/inventory/barcode/page.tsx
└── BarcodeScannerPage (Server Component)
    └── BarcodeScannerContainer (Client Component)
        ├── CameraPermissionGuard
        │   └── PermissionRequestUI
        ├── BarcodeScannerView
        │   ├── CameraStream
        │   │   └── QuaggaScanner
        │   ├── ScanOverlay
        │   │   ├── ScanFrame
        │   │   └── ScanIndicator
        │   └── ScanControls
        │       ├── ModeSelector
        │       ├── FlashlightToggle (mobile)
        │       └── CameraFlip (mobile)
        ├── ManualInputFallback
        │   ├── BarcodeInput
        │   └── SearchButton
        ├── ProductDetailsModal
        │   ├── ProductInfo
        │   ├── StockDisplay
        │   └── ActionPanel (mode-based)
        └── ScanHistoryDrawer
            └── ScanHistoryList
```

---

## 📦 Component Specifications

### 1. BarcodeScannerContainer

**Path**: `app/(main)/inventory/barcode/components/BarcodeScannerContainer.tsx`

**Props**:
```typescript
interface BarcodeScannerContainerProps {
  initialMode?: 'INBOUND' | 'OUTBOUND' | 'LOOKUP';
  defaultCenterId?: string;
}
```

**State**:
```typescript
interface ScannerState {
  mode: 'INBOUND' | 'OUTBOUND' | 'LOOKUP';
  cameraPermission: 'granted' | 'denied' | 'prompt';
  isScanning: boolean;
  scannedProduct: Product | null;
  showProductModal: boolean;
  showHistory: boolean;
  recentScans: ScanLog[];
  error: string | null;
}
```

**Responsibilities**:
- Manage overall scanner state
- Handle camera permission
- Coordinate child components
- Fetch and display product data

---

### 2. CameraStream

**Path**: `app/(main)/inventory/barcode/components/CameraStream.tsx`

**Props**:
```typescript
interface CameraStreamProps {
  onBarcodeDetected: (barcode: string) => void;
  isActive: boolean;
  facingMode?: 'user' | 'environment';
}
```

**Key Features**:
- Initialize MediaDevices stream
- Integrate quagga2 scanner
- Handle camera errors gracefully
- Support camera flip (front/back)
- Auto-focus on tap (mobile)

**Implementation**:
```typescript
'use client';

import { useEffect, useRef } from 'react';
import Quagga from '@ericblade/quagga2';

export function CameraStream({ onBarcodeDetected, isActive, facingMode = 'environment' }: CameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isActive) return;

    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: videoRef.current,
        constraints: {
          facingMode,
          width: { min: 640 },
          height: { min: 480 },
        },
      },
      decoder: {
        readers: [
          'ean_reader',      // EAN-13, EAN-8
          'code_128_reader', // Code 128
          'code_39_reader',  // Code 39
          'upc_reader',      // UPC-A, UPC-E
        ],
      },
      locate: true,
    }, (err) => {
      if (err) {
        console.error('Quagga initialization failed:', err);
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected((result) => {
      const barcode = result.codeResult.code;
      if (barcode) {
        onBarcodeDetected(barcode);
      }
    });

    return () => {
      Quagga.stop();
    };
  }, [isActive, facingMode, onBarcodeDetected]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
    </div>
  );
}
```

---

### 3. ScanOverlay

**Path**: `app/(main)/inventory/barcode/components/ScanOverlay.tsx`

**Purpose**: Visual guide for barcode scanning area

**Design**:
```typescript
export function ScanOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Dark overlay with transparent center */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Scan frame */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-48 border-4 border-green-500 rounded-lg">
        {/* Corner markers */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white -m-1" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white -m-1" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white -m-1" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white -m-1" />
      </div>

      {/* Instruction text */}
      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-white text-sm bg-black/70 px-4 py-2 rounded-full inline-block">
          바코드를 스캔 영역에 맞춰주세요
        </p>
      </div>
    </div>
  );
}
```

---

### 4. ProductDetailsModal

**Path**: `app/(main)/inventory/barcode/components/ProductDetailsModal.tsx`

**Props**:
```typescript
interface ProductDetailsModalProps {
  product: ProductWithStock | null;
  mode: 'INBOUND' | 'OUTBOUND' | 'LOOKUP';
  centerId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
}

interface ProductWithStock extends Product {
  centerStocks: Array<{
    centerId: string;
    centerName: string;
    centerCode: string;
    stock: number;
  }>;
}
```

**Layout**:
```typescript
export function ProductDetailsModal({ product, mode, centerId, open, onOpenChange, onActionComplete }: ProductDetailsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!product || !centerId) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/inventory/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: product.barcode,
          scanType: mode,
          quantity,
          centerId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`${mode === 'INBOUND' ? '입고' : '출고'} 처리 완료`);
        onActionComplete();
        onOpenChange(false);
      } else {
        toast.error(data.error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>스캔 완료</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-4">
            {/* Product Image */}
            <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden">
              {product.imageUrl ? (
                <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No Image
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">{product.name}</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>바코드: {product.barcode}</p>
                <p>판매가: {product.sellPrice?.toLocaleString()}원</p>
              </div>
            </div>

            {/* Stock Info */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">센터별 재고</h4>
              <div className="space-y-1 text-sm">
                {product.centerStocks.map((stock) => (
                  <div key={stock.centerId} className="flex justify-between">
                    <span>{stock.centerName} ({stock.centerCode})</span>
                    <span className="font-medium">{stock.stock}개</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Panel (mode-based) */}
            {mode !== 'LOOKUP' && (
              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium">수량</label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    `${mode === 'INBOUND' ? '입고' : '출고'} 완료`
                  )}
                </Button>
              </div>
            )}

            {mode === 'LOOKUP' && (
              <Button asChild className="w-full">
                <Link href={`/products/${product.id}`}>
                  상품 상세 보기
                </Link>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

### 5. ManualInputFallback

**Path**: `app/(main)/inventory/barcode/components/ManualInputFallback.tsx`

**Purpose**: Fallback when camera is unavailable or barcode can't be scanned

```typescript
interface ManualInputFallbackProps {
  onSearch: (barcode: string) => void;
}

export function ManualInputFallback({ onSearch }: ManualInputFallbackProps) {
  const [barcode, setBarcode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode.trim()) {
      onSearch(barcode.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="text"
        placeholder="바코드 번호 입력"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        className="flex-1"
      />
      <Button type="submit">검색</Button>
    </form>
  );
}
```

---

### 6. ScanHistoryDrawer

**Path**: `app/(main)/inventory/barcode/components/ScanHistoryDrawer.tsx`

**Props**:
```typescript
interface ScanHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: ScanLog[];
}

interface ScanLog {
  id: string;
  barcode: string;
  productName: string | null;
  scanType: 'INBOUND' | 'OUTBOUND' | 'LOOKUP';
  quantity: number | null;
  scannedAt: Date;
}
```

**Design**: Side drawer (right side) with recent scan list

---

## 💾 Data Model

### Prisma Schema Updates

#### 1. Add barcode field to Product

```prisma
model Product {
  id          String   @id @default(cuid())
  // ... existing fields
  barcode     String?  @unique  // NEW: Barcode field

  // ... existing relations
  scanLogs    ScanLog[] // NEW: Relation to ScanLog

  @@index([barcode])
}
```

#### 2. Create ScanLog table

```prisma
model ScanLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  productId   String?
  product     Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  barcode     String   // Always store barcode even if product not found
  scanType    String   // "INBOUND" | "OUTBOUND" | "LOOKUP"
  quantity    Int?     // Null for LOOKUP mode

  centerId    String?
  center      Center?  @relation(fields: [centerId], references: [id], onDelete: SetNull)

  scannedAt   DateTime @default(now())
  metadata    Json?    // Additional context (device, browser, etc.)

  @@index([userId, scannedAt(sort: Desc)])
  @@index([barcode])
  @@index([productId])
  @@index([centerId, scannedAt(sort: Desc)])
}
```

#### 3. Migration File

**File**: `prisma/migrations/YYYYMMDDHHMMSS_add_barcode_scanner/migration.sql`

```sql
-- AlterTable: Add barcode field to Product
ALTER TABLE "Product" ADD COLUMN "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");

-- CreateTable: ScanLog
CREATE TABLE "ScanLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "barcode" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "quantity" INTEGER,
    "centerId" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanLog_userId_scannedAt_idx" ON "ScanLog"("userId", "scannedAt" DESC);
CREATE INDEX "ScanLog_barcode_idx" ON "ScanLog"("barcode");
CREATE INDEX "ScanLog_productId_idx" ON "ScanLog"("productId");
CREATE INDEX "ScanLog_centerId_scannedAt_idx" ON "ScanLog"("centerId", "scannedAt" DESC);

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_centerId_fkey"
    FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## 🌐 API Specification

### 1. GET /api/products/barcode/[code]

**File**: `app/api/products/barcode/[code]/route.ts`

**Purpose**: Fetch product by barcode

**Request**:
```
GET /api/products/barcode/8801234567890
```

**Response Success (200)**:
```json
{
  "success": true,
  "data": {
    "id": "prod_123",
    "name": "테스트 상품 A",
    "barcode": "8801234567890",
    "sellPrice": 5000,
    "category": "식품",
    "imageUrl": "/uploads/products/image.jpg",
    "centerStocks": [
      {
        "centerId": "center_1",
        "centerName": "서울센터",
        "centerCode": "01-4213",
        "stock": 150
      }
    ]
  }
}
```

**Response Not Found (404)**:
```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "바코드에 해당하는 상품을 찾을 수 없습니다"
  }
}
```

**Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { ok, notFound, unauthorized } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user?.userId) {
    return unauthorized('로그인이 필요합니다');
  }

  const { code } = await params;

  const product = await prisma.product.findUnique({
    where: { barcode: code },
    include: {
      centerStocks: {
        include: {
          center: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    return notFound('바코드에 해당하는 상품을 찾을 수 없습니다');
  }

  return ok({
    ...product,
    centerStocks: product.centerStocks.map((cs) => ({
      centerId: cs.center.id,
      centerName: cs.center.name,
      centerCode: cs.center.code,
      stock: cs.stock,
    })),
  });
}
```

---

### 2. POST /api/inventory/scan

**File**: `app/api/inventory/scan/route.ts`

**Purpose**: Record scan event and update inventory

**Request**:
```json
{
  "barcode": "8801234567890",
  "scanType": "INBOUND",
  "quantity": 100,
  "centerId": "center_1"
}
```

**Response Success (200)**:
```json
{
  "success": true,
  "data": {
    "scanLogId": "log_456",
    "productId": "prod_123",
    "updatedStock": 250,
    "previousStock": 150,
    "scannedAt": "2026-04-15T10:30:00Z"
  }
}
```

**Validation Rules**:
- `barcode`: Required, string
- `scanType`: Required, enum ["INBOUND", "OUTBOUND", "LOOKUP"]
- `quantity`: Required for INBOUND/OUTBOUND, integer > 0
- `centerId`: Required for INBOUND/OUTBOUND

**Implementation**:
```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { ok, badRequest, unauthorized } from '@/lib/api/response';
import { z } from 'zod';

const scanSchema = z.object({
  barcode: z.string().min(1),
  scanType: z.enum(['INBOUND', 'OUTBOUND', 'LOOKUP']),
  quantity: z.number().int().positive().optional(),
  centerId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.userId) {
    return unauthorized('로그인이 필요합니다');
  }

  const body = await request.json();
  const validation = scanSchema.safeParse(body);

  if (!validation.success) {
    return badRequest(validation.error.message);
  }

  const { barcode, scanType, quantity, centerId } = validation.data;

  // Validate quantity for INBOUND/OUTBOUND
  if ((scanType === 'INBOUND' || scanType === 'OUTBOUND') && !quantity) {
    return badRequest('수량을 입력해주세요');
  }

  // Validate centerId for INBOUND/OUTBOUND
  if ((scanType === 'INBOUND' || scanType === 'OUTBOUND') && !centerId) {
    return badRequest('센터를 선택해주세요');
  }

  // Find product by barcode
  const product = await prisma.product.findUnique({
    where: { barcode },
  });

  // Create scan log (even if product not found for audit)
  const scanLog = await prisma.scanLog.create({
    data: {
      userId: session.user.userId,
      productId: product?.id,
      barcode,
      scanType,
      quantity,
      centerId,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      },
    },
  });

  let updatedStock = null;
  let previousStock = null;

  // Update stock if product found and mode is INBOUND/OUTBOUND
  if (product && centerId && quantity) {
    const centerStock = await prisma.productCenterStock.findUnique({
      where: {
        productId_centerId: {
          productId: product.id,
          centerId,
        },
      },
    });

    previousStock = centerStock?.stock || 0;

    if (scanType === 'INBOUND') {
      updatedStock = await prisma.productCenterStock.upsert({
        where: {
          productId_centerId: {
            productId: product.id,
            centerId,
          },
        },
        update: {
          stock: { increment: quantity },
        },
        create: {
          productId: product.id,
          centerId,
          stock: quantity,
        },
        select: { stock: true },
      });
    } else if (scanType === 'OUTBOUND') {
      if (!centerStock || centerStock.stock < quantity) {
        return badRequest('재고가 부족합니다');
      }

      updatedStock = await prisma.productCenterStock.update({
        where: {
          productId_centerId: {
            productId: product.id,
            centerId,
          },
        },
        data: {
          stock: { decrement: quantity },
        },
        select: { stock: true },
      });
    }
  }

  return ok({
    scanLogId: scanLog.id,
    productId: product?.id,
    updatedStock: updatedStock?.stock,
    previousStock,
    scannedAt: scanLog.scannedAt,
  });
}
```

---

### 3. GET /api/inventory/scan-history

**File**: `app/api/inventory/scan-history/route.ts`

**Purpose**: Fetch recent scan history

**Query Parameters**:
- `limit`: Number (default: 20, max: 100)
- `scanType`: String (optional filter)
- `centerId`: String (optional filter)

**Request**:
```
GET /api/inventory/scan-history?limit=10&scanType=INBOUND
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "log_456",
      "barcode": "8801234567890",
      "productName": "테스트 상품 A",
      "scanType": "INBOUND",
      "quantity": 100,
      "centerName": "서울센터",
      "scannedAt": "2026-04-15T10:30:00Z"
    }
  ]
}
```

**Implementation**:
```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { ok, unauthorized } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.userId) {
    return unauthorized('로그인이 필요합니다');
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const scanType = searchParams.get('scanType');
  const centerId = searchParams.get('centerId');

  const where: any = {
    userId: session.user.userId,
  };

  if (scanType) {
    where.scanType = scanType;
  }

  if (centerId) {
    where.centerId = centerId;
  }

  const history = await prisma.scanLog.findMany({
    where,
    include: {
      product: {
        select: {
          name: true,
        },
      },
      center: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      scannedAt: 'desc',
    },
    take: limit,
  });

  return ok(
    history.map((log) => ({
      id: log.id,
      barcode: log.barcode,
      productName: log.product?.name || null,
      scanType: log.scanType,
      quantity: log.quantity,
      centerName: log.center?.name || null,
      scannedAt: log.scannedAt,
    }))
  );
}
```

---

## 📁 File Structure

```
app/
├── (main)/
│   └── inventory/
│       └── barcode/
│           ├── page.tsx                          # Main scanner page (Server Component)
│           ├── components/
│           │   ├── BarcodeScannerContainer.tsx   # Main client container
│           │   ├── CameraPermissionGuard.tsx     # Permission request UI
│           │   ├── CameraStream.tsx              # Camera + Quagga integration
│           │   ├── ScanOverlay.tsx               # Scan frame overlay
│           │   ├── ScanControls.tsx              # Mode selector, settings
│           │   ├── ManualInputFallback.tsx       # Manual barcode input
│           │   ├── ProductDetailsModal.tsx       # Product info + actions
│           │   └── ScanHistoryDrawer.tsx         # Recent scans list
│           └── hooks/
│               ├── useBarcodeScanner.ts          # Scanner logic hook
│               ├── useCameraPermission.ts        # Permission state hook
│               └── useScanHistory.ts             # History fetch hook
│
└── api/
    ├── products/
    │   └── barcode/
    │       └── [code]/
    │           └── route.ts                      # GET: Fetch product by barcode
    └── inventory/
        ├── scan/
        │   └── route.ts                          # POST: Record scan + update stock
        └── scan-history/
            └── route.ts                          # GET: Fetch scan history

prisma/
├── schema.prisma                                  # Updated schema (Product.barcode, ScanLog)
└── migrations/
    └── YYYYMMDDHHMMSS_add_barcode_scanner/
        └── migration.sql                          # Migration SQL

package.json                                       # Add quagga2, react-webcam
```

---

## 🪝 Custom Hooks

### useBarcodeScanner

**Path**: `app/(main)/inventory/barcode/hooks/useBarcodeScanner.ts`

```typescript
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  barcode: string;
  sellPrice: number;
  imageUrl: string | null;
  centerStocks: Array<{
    centerId: string;
    centerName: string;
    centerCode: string;
    stock: number;
  }>;
}

export function useBarcodeScanner() {
  const [isLoading, setIsLoading] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  const fetchProduct = useCallback(async (barcode: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/products/barcode/${barcode}`);
      const data = await response.json();

      if (data.success) {
        setProduct(data.data);
        return data.data;
      } else {
        toast.error(data.error.message || '상품을 찾을 수 없습니다');
        setProduct(null);
        return null;
      }
    } catch (error) {
      toast.error('상품 조회 중 오류가 발생했습니다');
      setProduct(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProduct(null);
  }, []);

  return {
    product,
    isLoading,
    fetchProduct,
    reset,
  };
}
```

---

### useCameraPermission

**Path**: `app/(main)/inventory/barcode/hooks/useCameraPermission.ts`

```typescript
import { useState, useEffect } from 'react';

type PermissionState = 'granted' | 'denied' | 'prompt';

export function useCameraPermission() {
  const [permission, setPermission] = useState<PermissionState>('prompt');

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setPermission(result.state as PermissionState);

      result.addEventListener('change', () => {
        setPermission(result.state as PermissionState);
      });
    } catch (error) {
      console.error('Permission check failed:', error);
    }
  };

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setPermission('granted');
      return true;
    } catch (error) {
      setPermission('denied');
      return false;
    }
  };

  return {
    permission,
    requestPermission,
  };
}
```

---

## 🎨 UI State Management

### Scanner State Machine

```
┌─────────────┐
│   INITIAL   │
└──────┬──────┘
       │ Request Permission
       ↓
┌─────────────┐
│ REQUESTING  │
│ PERMISSION  │
└──────┬──────┘
       │
       ├──→ [Granted] ──→ ┌──────────┐
       │                  │ SCANNING │
       │                  └────┬─────┘
       │                       │ Barcode Detected
       │                       ↓
       │                  ┌──────────────┐
       │                  │ FETCHING     │
       │                  │ PRODUCT      │
       │                  └────┬─────────┘
       │                       │
       │                       ├──→ [Found] ──→ ┌─────────────┐
       │                       │                 │ SHOWING     │
       │                       │                 │ PRODUCT     │
       │                       │                 └─────────────┘
       │                       │
       │                       └──→ [Not Found] ──→ ┌──────────┐
       │                                             │ ERROR    │
       │                                             └──────────┘
       │
       └──→ [Denied] ──→ ┌───────────────┐
                         │ MANUAL INPUT  │
                         └───────────────┘
```

---

## 📱 Responsive Design

### Breakpoints

| Device | Width | Camera Layout |
|--------|-------|---------------|
| Mobile | < 768px | Portrait, fullscreen |
| Tablet | 768-1023px | Landscape, 80% height |
| Desktop | ≥ 1024px | Centered, 60% width |

### Mobile-Specific Features

1. **Touch Gestures**:
   - Tap to focus camera
   - Pinch to zoom
   - Swipe up for manual input

2. **Orientation Support**:
   - Lock to portrait for scanning
   - Landscape mode for product details

3. **Hardware Access**:
   - Flashlight toggle (if available)
   - Front/back camera flip

---

## 🔒 Security Considerations

### 1. Authentication
- All API routes require authenticated session
- User ID from session for audit logging

### 2. Authorization
- Validate center access (user must have access to centerId)
- SELLER role can only update their assigned centers
- ADMIN/MASTER can update all centers

### 3. Input Validation
- Barcode format validation (numeric, EAN-13, etc.)
- Quantity validation (positive integer)
- SQL injection prevention (Prisma ORM)

### 4. Audit Trail
- All scans logged in ScanLog table
- Include user, timestamp, device metadata
- Track both successful and failed scans

---

## ⚡ Performance Optimization

### 1. Camera Stream
- Use 640x480 resolution for balance (quality vs performance)
- 30 FPS frame rate
- Hardware acceleration where available

### 2. Barcode Detection
- Debounce detection (500ms cooldown)
- Stop scanning after successful detection
- Limited decoder readers (only necessary formats)

### 3. API Calls
- Cache recent products (5-minute TTL)
- Optimistic UI updates for stock changes
- Background sync for scan history

### 4. Mobile Optimization
- Lazy load quagga2 library
- Preload product images
- Service worker for offline detection

---

## 🧪 Testing Strategy

### Unit Tests

**File**: `app/(main)/inventory/barcode/__tests__/useBarcodeScanner.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

describe('useBarcodeScanner', () => {
  it('should fetch product by barcode', async () => {
    const { result } = renderHook(() => useBarcodeScanner());

    await waitFor(async () => {
      const product = await result.current.fetchProduct('8801234567890');
      expect(product).toHaveProperty('name');
    });
  });

  it('should handle not found error', async () => {
    const { result } = renderHook(() => useBarcodeScanner());

    await waitFor(async () => {
      const product = await result.current.fetchProduct('0000000000000');
      expect(product).toBeNull();
    });
  });
});
```

---

### Integration Tests

**File**: `app/api/inventory/scan/__tests__/route.test.ts`

```typescript
import { POST } from '../route';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/auth');
jest.mock('@/lib/db/prisma');

describe('POST /api/inventory/scan', () => {
  it('should create scan log and update stock for INBOUND', async () => {
    // Mock session
    (auth as jest.Mock).mockResolvedValue({
      user: { userId: 'user_1' },
    });

    // Mock product lookup
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 'prod_1',
      barcode: '8801234567890',
    });

    const request = new Request('http://localhost/api/inventory/scan', {
      method: 'POST',
      body: JSON.stringify({
        barcode: '8801234567890',
        scanType: 'INBOUND',
        quantity: 100,
        centerId: 'center_1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('scanLogId');
    expect(prisma.scanLog.create).toHaveBeenCalled();
  });
});
```

---

### E2E Tests (Playwright)

**File**: `tests/e2e/inventory/barcode-scanner.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Barcode Scanner', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('should scan barcode and display product', async ({ page }) => {
    await page.goto('/inventory/barcode?mode=LOOKUP');

    // Grant camera permission (mock)
    await page.context().grantPermissions(['camera']);

    // Wait for scanner to load
    await expect(page.locator('video')).toBeVisible();

    // Simulate barcode detection (manual input as fallback)
    await page.fill('input[placeholder*="바코드"]', '8801234567890');
    await page.click('button:has-text("검색")');

    // Product modal should appear
    await expect(page.locator('dialog')).toBeVisible();
    await expect(page.locator('text=스캔 완료')).toBeVisible();

    // Product info should be displayed
    await expect(page.locator('text=바코드: 8801234567890')).toBeVisible();
  });

  test('should process INBOUND scan', async ({ page }) => {
    await page.goto('/inventory/barcode?mode=INBOUND');

    // Manual input
    await page.fill('input[placeholder*="바코드"]', '8801234567890');
    await page.click('button:has-text("검색")');

    // Enter quantity
    await page.fill('input[type="number"]', '100');

    // Submit
    await page.click('button:has-text("입고 완료")');

    // Success toast
    await expect(page.locator('text=입고 처리 완료')).toBeVisible();
  });
});
```

---

## 📊 Implementation Order

### Phase 1: Core Scanner (2 days) ✅

**Priority**: P0 (Critical)

1. **Day 1 Morning**: Database & API Foundation
   - [ ] Create Prisma migration (ScanLog, Product.barcode)
   - [ ] Run migration: `npx prisma migrate dev`
   - [ ] Implement GET `/api/products/barcode/[code]`
   - [ ] Test API with Postman/curl

2. **Day 1 Afternoon**: Basic Scanner UI
   - [ ] Install dependencies: `npm install quagga2`
   - [ ] Create page: `app/(main)/inventory/barcode/page.tsx`
   - [ ] Implement `CameraStream` component
   - [ ] Implement `ScanOverlay` component
   - [ ] Test camera permission and stream

3. **Day 2 Morning**: Barcode Detection
   - [ ] Integrate quagga2 scanner
   - [ ] Implement barcode detection callback
   - [ ] Add debounce logic (500ms)
   - [ ] Test with real barcodes

4. **Day 2 Afternoon**: Manual Input & Testing
   - [ ] Implement `ManualInputFallback`
   - [ ] Add error handling
   - [ ] Test camera denied scenario
   - [ ] Mobile responsive layout

---

### Phase 2: Product Integration (1 day) ✅

**Priority**: P0 (Critical)

5. **Day 3 Morning**: Product Details Modal
   - [ ] Implement `ProductDetailsModal` component
   - [ ] Display product info
   - [ ] Show center stocks
   - [ ] Add image display

6. **Day 3 Afternoon**: Scanner-Product Flow
   - [ ] Connect scanner to modal
   - [ ] Implement `useBarcodeScanner` hook
   - [ ] Add loading states
   - [ ] Test end-to-end flow

---

### Phase 3: Inventory Actions (1 day) ✅

**Priority**: P1 (Important)

7. **Day 4 Morning**: Scan API Implementation
   - [ ] Implement POST `/api/inventory/scan`
   - [ ] Add stock update logic (INBOUND/OUTBOUND)
   - [ ] Implement validation
   - [ ] Add audit logging

8. **Day 4 Afternoon**: Action Panel
   - [ ] Add mode selector (INBOUND/OUTBOUND/LOOKUP)
   - [ ] Implement quantity input
   - [ ] Add submit handlers
   - [ ] Show success/error toasts

---

### Phase 4: History & Polish (1 day) ✅

**Priority**: P2 (Nice to have)

9. **Day 5 Morning**: Scan History
   - [ ] Implement GET `/api/inventory/scan-history`
   - [ ] Create `ScanHistoryDrawer` component
   - [ ] Implement `useScanHistory` hook
   - [ ] Add history list UI

10. **Day 5 Afternoon**: Settings & Optimization
    - [ ] Add camera flip (front/back)
    - [ ] Implement flashlight toggle (mobile)
    - [ ] Add beep sound on scan
    - [ ] Performance optimization
    - [ ] E2E tests
    - [ ] Documentation update

---

## ✅ Acceptance Criteria Checklist

### Functional Requirements
- [ ] Camera stream works on Chrome, Safari (desktop & mobile)
- [ ] Barcode detection works for EAN-13, Code 128, UPC
- [ ] Manual input fallback when camera unavailable
- [ ] Product lookup by barcode displays correct info
- [ ] INBOUND mode increases stock correctly
- [ ] OUTBOUND mode decreases stock correctly
- [ ] LOOKUP mode displays product details
- [ ] Scan history shows recent scans
- [ ] All scans logged to database

### Non-Functional Requirements
- [ ] Camera permission request is clear
- [ ] Barcode detection latency < 500ms
- [ ] API response time < 1 second
- [ ] Mobile responsive (portrait & landscape)
- [ ] No console errors
- [ ] Accessibility: keyboard navigation works
- [ ] Error messages are user-friendly

### Testing
- [ ] Unit tests: 80% coverage
- [ ] Integration tests: All API routes tested
- [ ] E2E tests: 3 critical flows tested
- [ ] Manual testing on 3+ devices

---

**Created**: 2026-04-15
**Author**: Development Team
**Status**: Ready for Implementation
**Next Phase**: `/pdca do barcode-ui`
