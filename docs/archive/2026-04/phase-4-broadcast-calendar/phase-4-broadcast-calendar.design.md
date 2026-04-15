# Phase 4: Broadcast Calendar Enhancement - Design Document

> **Feature**: 방송 캘린더 고도화 (Broadcast Calendar Enhancement)
> **PDCA Phase**: Design
> **Plan Document**: [phase-4-broadcast-calendar.plan.md](../../01-plan/features/phase-4-broadcast-calendar.plan.md)
> **Created**: 2026-04-15

---

## 📐 Architecture Design

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Client)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐      ┌──────────────────────┐         │
│  │  /broadcasts/page    │      │ /broadcasts/[id]/    │         │
│  │  ──────────────────  │      │      live/page       │         │
│  │  - 방송 목록         │      │  ──────────────────  │         │
│  │  - 방송 시작 버튼    │ ───> │  - 센터 상품 로드    │         │
│  └──────────────────────┘      │  - 실시간 판매 트래킹 │         │
│           │                     └──────────────────────┘         │
│           │                              ↑                        │
│           ↓                              │                        │
│  ┌────────────────────────────────────────┐                      │
│  │   StartBroadcastDialog (Modal)        │                      │
│  │   ─────────────────────────────────   │                      │
│  │   1. 센터코드 입력 (Input)             │                      │
│  │   2. 검증 버튼 (POST validate-code)    │                      │
│  │   3. 센터 정보 표시 (Alert)            │                      │
│  │   4. 방송 시작 (POST start + redirect) │                      │
│  └────────────────────────────────────────┘                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (Next.js API Routes)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Server)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              API Layer (Next.js API Routes)              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                           │   │
│  │  POST /api/centers/validate-code                         │   │
│  │  ├─ Auth: MASTER only                                    │   │
│  │  ├─ Input: { code: string }                              │   │
│  │  └─ Output: { valid, available, center?, message }       │   │
│  │                                                           │   │
│  │  GET /api/centers/check-available?code=XX-XXXX           │   │
│  │  ├─ Auth: MASTER, SUB_MASTER, ADMIN                      │   │
│  │  └─ Output: { code, available, exists }                  │   │
│  │                                                           │   │
│  │  POST /api/broadcasts/[id]/start                         │   │
│  │  ├─ Auth: SELLER, ADMIN                                  │   │
│  │  ├─ Input: { centerId: string }                          │   │
│  │  └─ Updates: Broadcast.centerId, Broadcast.status        │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                    │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          Service Layer (Business Logic)                  │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                           │   │
│  │  lib/services/center/centerService.ts                    │   │
│  │  ├─ validateCenterCode(code): Validation + Availability  │   │
│  │  └─ getCenterByCode(code): Find existing center          │   │
│  │                                                           │   │
│  │  lib/services/broadcast/broadcastService.ts (신규)       │   │
│  │  └─ startBroadcast(id, centerId): Update broadcast       │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                    │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Data Layer (Prisma + PostgreSQL)            │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                           │   │
│  │  Models: Broadcast, Center, Product, ProductCenterStock  │   │
│  │                                                           │   │
│  │  Key Relations:                                           │   │
│  │  ├─ Broadcast.centerId → Center.id                       │   │
│  │  ├─ ProductCenterStock.centerId → Center.id              │   │
│  │  └─ ProductCenterStock.productId → Product.id            │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Design

### Existing Schema (No Changes Required)

Phase 1에서 이미 필요한 모든 테이블과 관계가 구축되어 있습니다.

```prisma
// prisma/schema.prisma

model Broadcast {
  id          String    @id @default(cuid())
  title       String
  description String?   @db.Text
  scheduledAt DateTime
  startedAt   DateTime?
  endedAt     DateTime?
  status      String    @default("SCHEDULED") // SCHEDULED, LIVE, ENDED, CANCELLED

  sellerId    String
  seller      User      @relation(fields: [sellerId], references: [id])

  centerId    String?   // ✅ Phase 1에서 이미 추가됨
  center      Center?   @relation(fields: [centerId], references: [id])

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([sellerId])
  @@index([centerId])
  @@index([scheduledAt])
  @@index([status])
}

model Center {
  id                    String    @id @default(cuid())
  code                  String    @unique  // "01-4213" format
  regionCode            String    // "01"
  phoneCode             String    // "4213"
  name                  String
  regionName            String
  address               String?
  addressDetail         String?
  representative        String?
  representativePhone   String?
  businessNo            String?
  contractStartDate     DateTime?
  contractEndDate       DateTime?
  isActive              Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  users                 User[]
  centerStocks          ProductCenterStock[]
  broadcasts            Broadcast[]  // ✅ Phase 1에서 이미 추가됨

  @@index([code])
  @@index([regionCode])
  @@index([isActive])
}

model Product {
  id            String    @id @default(cuid())
  code          String    @unique
  barcode       String    @unique
  name          String
  category      String?
  supplyPrice   Int
  sellPrice     Int
  marginRate    Float
  totalStock    Int       @default(0)
  active        Boolean   @default(true)
  // productType String?  @default("CENTER")  // TODO: Phase 5에서 추가 예정

  centerStocks  ProductCenterStock[]
  warehouseInventory WarehouseInventory[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([barcode])
  @@index([code])
  @@index([active])
}

model ProductCenterStock {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  centerId   String
  center     Center   @relation(fields: [centerId], references: [id], onDelete: Cascade)

  stock      Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([productId, centerId])
  @@index([centerId])
  @@index([productId])
}
```

### Data Flow Queries

#### Query 1: 센터코드로 센터 조회
```typescript
// lib/services/center/centerService.ts
export async function getCenterByCode(code: string) {
  return await prisma.center.findUnique({
    where: { code },
    include: {
      _count: {
        select: {
          users: true,
          centerStocks: true,
          broadcasts: true
        }
      }
    }
  });
}
```

#### Query 2: 센터별 상품 로드
```typescript
// app/(main)/broadcasts/[id]/live/page.tsx
const centerProducts = await prisma.product.findMany({
  where: {
    centerStocks: {
      some: {
        centerId: activeCenterId,
      },
    },
  },
  include: {
    centerStocks: {
      where: {
        centerId: activeCenterId,
      },
    },
    warehouseInventory: true,
  },
  orderBy: {
    name: "asc",
  },
});
```

#### Query 3: 본사 상품 로드 (Phase 5에서 개선)
```typescript
// Phase 4: 모든 active 상품 로드
const hqProducts = await prisma.product.findMany({
  where: {
    active: true,
  },
  include: {
    warehouseInventory: true,
  },
});

// Phase 5: productType 필드 추가 후
const hqProducts = await prisma.product.findMany({
  where: {
    productType: 'HEADQUARTERS',
    active: true,
  },
  include: {
    warehouseInventory: true,
  },
});
```

#### Query 4: 방송 시작 (centerId 업데이트)
```typescript
// lib/services/broadcast/broadcastService.ts
export async function startBroadcast(id: string, centerId: string) {
  return await prisma.broadcast.update({
    where: { id },
    data: {
      centerId,
      status: 'LIVE',
      startedAt: new Date(),
    },
  });
}
```

---

## 🔌 API Design

### Phase 4.1: 센터코드 검증 API

#### 1. POST /api/centers/validate-code

**Purpose**: 센터코드 형식 검증 + 사용 가능 여부 확인

**File**: `app/api/centers/validate-code/route.ts`

**Request**:
```typescript
POST /api/centers/validate-code
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "code": "01-4213"
}
```

**Response (Success - Available)**:
```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "valid": true,
    "available": true,
    "message": "Center code is valid and available"
  }
}
```

**Response (Success - Already Exists)**:
```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "valid": true,
    "available": false,
    "center": {
      "id": "clxxx123",
      "code": "01-4213",
      "name": "서울 강남센터",
      "regionName": "서울특별시",
      "_count": {
        "users": 5,
        "centerStocks": 120,
        "broadcasts": 8
      }
    },
    "message": "Center code 01-4213 is already in use"
  }
}
```

**Response (Error - Invalid Format)**:
```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "valid": false,
    "available": false,
    "message": "Invalid format. Expected: \"01-4213\" (2-digit region code + 4-digit phone code)"
  }
}
```

**Response (Error - Unauthorized)**:
```typescript
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다"
  }
}
```

**Response (Error - Forbidden)**:
```typescript
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "센터 코드 검증 권한이 없습니다"
  }
}
```

**Implementation**:
```typescript
// app/api/centers/validate-code/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { validateCenterCode } from '@/lib/services/center/centerService';
import { getCenterByCode } from '@/lib/services/center/centerService';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth();
    if (!session) return errors.unauthorized();

    // 2. Authorization (MASTER only for validation)
    if (session.user?.role !== 'MASTER') {
      return errors.forbidden('센터 코드 검증 권한이 없습니다');
    }

    // 3. Parse request body
    const body = await req.json();
    if (!body.code) {
      return errors.badRequest('code 필드가 필요합니다');
    }

    // 4. Validate center code
    const validation = await validateCenterCode(body.code);

    // 5. If code exists, fetch full center details
    let responseData = validation;
    if (validation.valid && !validation.available) {
      const center = await getCenterByCode(body.code);
      responseData = {
        ...validation,
        center,
      };
    }

    return ok(responseData);
  } catch (error) {
    console.error('Failed to validate center code:', error);
    const message = error instanceof Error ? error.message : 'Failed to validate center code';
    return errors.internal(message);
  }
}
```

**Validation Logic** (Existing):
```typescript
// lib/services/center/centerService.ts (lines 254-284)
export async function validateCenterCode(code: string): Promise<{
  valid: boolean;
  available: boolean;
  message: string;
}> {
  const codePattern = /^\d{2}-\d{4}$/;

  if (!codePattern.test(code)) {
    return {
      valid: false,
      available: false,
      message:
        'Invalid format. Expected: "01-4213" (2-digit region code + 4-digit phone code)',
    };
  }

  const existing = await getCenterByCode(code);
  if (existing) {
    return {
      valid: true,
      available: false,
      message: `Center code ${code} is already in use`,
    };
  }

  return {
    valid: true,
    available: true,
    message: 'Center code is valid and available',
  };
}
```

---

#### 2. GET /api/centers/check-available

**Purpose**: 센터코드 사용 가능 여부만 빠르게 확인 (캐시 가능)

**File**: `app/api/centers/check-available/route.ts`

**Request**:
```typescript
GET /api/centers/check-available?code=01-4213
Authorization: Bearer <session-token>
```

**Response (Available)**:
```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "code": "01-4213",
    "available": true,
    "exists": false
  }
}
```

**Response (Not Available)**:
```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "code": "01-4213",
    "available": false,
    "exists": true
  }
}
```

**Response (Error - Missing Parameter)**:
```typescript
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "code 쿼리 파라미터가 필요합니다"
  }
}
```

**Implementation**:
```typescript
// app/api/centers/check-available/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { getCenterByCode } from '@/lib/services/center/centerService';

export async function GET(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth();
    if (!session) return errors.unauthorized();

    // 2. Authorization (MASTER, SUB_MASTER, ADMIN allowed)
    const allowedRoles = ['MASTER', 'SUB_MASTER', 'ADMIN'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return errors.forbidden('센터 코드 조회 권한이 없습니다');
    }

    // 3. Parse query parameter
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (!code) {
      return errors.badRequest('code 쿼리 파라미터가 필요합니다');
    }

    // 4. Check if code exists
    const existing = await getCenterByCode(code);

    return ok({
      code,
      available: !existing,
      exists: !!existing,
    });
  } catch (error) {
    console.error('Failed to check code availability:', error);
    const message = error instanceof Error ? error.message : 'Failed to check code availability';
    return errors.internal(message);
  }
}
```

---

### Phase 4.2: 방송 시작 API

#### 3. POST /api/broadcasts/[id]/start (Modified)

**Purpose**: 방송 시작 시 centerId 저장

**File**: `app/api/broadcasts/[id]/start/route.ts`

**Request (Before - Phase 4)**:
```typescript
POST /api/broadcasts/clxxx123/start
Content-Type: application/json
Authorization: Bearer <session-token>

{}
```

**Request (After - Phase 4)**:
```typescript
POST /api/broadcasts/clxxx123/start
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "centerId": "clyyy456"  // ✅ 신규 필드
}
```

**Response (Success)**:
```typescript
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "clxxx123",
    "title": "주말 특가 라이브",
    "status": "LIVE",
    "startedAt": "2026-04-15T10:00:00.000Z",
    "centerId": "clyyy456",
    "center": {
      "id": "clyyy456",
      "code": "01-4213",
      "name": "서울 강남센터"
    }
  }
}
```

**Implementation Changes**:
```typescript
// app/api/broadcasts/[id]/start/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { startBroadcast } from '@/lib/services/broadcast/broadcastService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errors.unauthorized();

    const { id } = await params;

    // ✅ Parse centerId from request body (Phase 4 addition)
    const body = await req.json();
    const centerId = body.centerId || null;

    // Start broadcast with centerId
    const broadcast = await startBroadcast(id, centerId, session.user.id);

    return ok(broadcast);
  } catch (error) {
    console.error('Failed to start broadcast:', error);
    const message = error instanceof Error ? error.message : 'Failed to start broadcast';
    return errors.internal(message);
  }
}
```

---

## 🧩 Component Design

### Phase 4.1: StartBroadcastDialog Component

**File**: `components/broadcasts/StartBroadcastDialog.tsx`

**Purpose**: 방송 시작 전 센터코드 입력 및 검증

**Component Hierarchy**:
```
<StartBroadcastDialog>
  └─ <Dialog>
      ├─ <DialogTrigger>
      │   └─ <Button> 방송 시작 </Button>
      │
      └─ <DialogContent>
          ├─ <DialogHeader>
          │   ├─ <DialogTitle> 방송 시작 </DialogTitle>
          │   └─ <DialogDescription>
          │
          ├─ <div> Input Section
          │   ├─ <Input placeholder="예: 01-4213" />
          │   └─ <Button onClick={validateCenterCode}> 확인 </Button>
          │
          ├─ <Alert> Center Info (conditional)
          │   ├─ <CheckCircle icon />
          │   ├─ <AlertTitle> 센터 확인됨 </AlertTitle>
          │   └─ <AlertDescription>
          │       ├─ 센터명: {center.name}
          │       ├─ 지역: {center.regionName}
          │       └─ 상품 수: {center._count.centerStocks}개
          │
          └─ <DialogFooter>
              ├─ <Button variant="outline" onClick={closeDialog}> 취소 </Button>
              └─ <Button disabled={!center} onClick={startBroadcast}> 방송 시작 </Button>
```

**Props Interface**:
```typescript
interface StartBroadcastDialogProps {
  broadcastId: string;
  onStartSuccess?: (centerId: string) => void;
}
```

**State Management**:
```typescript
const [open, setOpen] = useState(false);
const [centerCode, setCenterCode] = useState('');
const [isValidating, setIsValidating] = useState(false);
const [center, setCenter] = useState<Center | null>(null);
const [error, setError] = useState<string | null>(null);
```

**Full Implementation**:
```typescript
// components/broadcasts/StartBroadcastDialog.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Center {
  id: string;
  code: string;
  name: string;
  regionName: string;
  _count: {
    users: number;
    centerStocks: number;
    broadcasts: number;
  };
}

interface StartBroadcastDialogProps {
  broadcastId: string;
  onStartSuccess?: (centerId: string) => void;
}

export function StartBroadcastDialog({
  broadcastId,
  onStartSuccess,
}: StartBroadcastDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [centerCode, setCenterCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [center, setCenter] = useState<Center | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateCenterCode = async () => {
    if (!centerCode.trim()) {
      setError('센터코드를 입력해주세요');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch('/api/centers/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: centerCode }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error.message || '센터코드 검증에 실패했습니다');
        setCenter(null);
        return;
      }

      const validation = data.data;

      if (!validation.valid) {
        setError(validation.message);
        setCenter(null);
        return;
      }

      if (!validation.available) {
        // Code exists - use the center
        setCenter(validation.center);
        setError(null);
      } else {
        // Code is available but doesn't exist
        setError('존재하지 않는 센터코드입니다');
        setCenter(null);
      }
    } catch (err) {
      console.error('Failed to validate center code:', err);
      setError('센터코드 검증 중 오류가 발생했습니다');
      setCenter(null);
    } finally {
      setIsValidating(false);
    }
  };

  const startBroadcast = async () => {
    if (!center) return;

    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ centerId: center.id }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error.message || '방송 시작에 실패했습니다');
        return;
      }

      toast.success('방송이 시작되었습니다');
      setOpen(false);

      // Navigate to live broadcast page
      router.push(`/broadcasts/${broadcastId}/live?centerId=${center.id}`);

      if (onStartSuccess) {
        onStartSuccess(center.id);
      }
    } catch (err) {
      console.error('Failed to start broadcast:', err);
      toast.error('방송 시작 중 오류가 발생했습니다');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCenterCode('');
    setCenter(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>방송 시작</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>방송 시작</DialogTitle>
          <DialogDescription>
            연결할 센터의 센터코드를 입력하세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="예: 01-4213"
              value={centerCode}
              onChange={(e) => setCenterCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  validateCenterCode();
                }
              }}
              disabled={isValidating}
            />
            <Button onClick={validateCenterCode} disabled={isValidating}>
              {isValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                '확인'
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {center && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>센터 확인됨</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <div>
                    <strong>센터명:</strong> {center.name}
                  </div>
                  <div>
                    <strong>지역:</strong> {center.regionName}
                  </div>
                  <div>
                    <strong>상품 수:</strong> {center._count.centerStocks}개
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={startBroadcast} disabled={!center}>
            방송 시작
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Dependencies**:
- `@/components/ui/dialog` - Dialog primitive (already exists)
- `@/components/ui/input` - Input component (already exists)
- `@/components/ui/button` - Button component (already exists)
- `@/components/ui/alert` - Alert component (already exists ✅)
- `lucide-react` - Icons (already installed)
- `sonner` - Toast notifications (already installed)

---

### Phase 4.2: ProductListForBroadcast Component

**File**: `components/broadcasts/ProductListForBroadcast.tsx`

**Purpose**: 센터별 상품 리스트 표시 및 검색

**Props Interface**:
```typescript
interface ProductWithStock {
  id: string;
  code: string;
  barcode: string;
  name: string;
  category: string | null;
  sellPrice: number;
  totalStock: number;
  centerStocks: {
    stock: number;
    centerId: string;
  }[];
  warehouseInventory: {
    warehouseId: string;
    quantity: number;
  }[];
}

interface ProductListForBroadcastProps {
  products: ProductWithStock[];
  centerId: string;
}
```

**Component Structure**:
```tsx
<ProductListForBroadcast>
  └─ <div className="space-y-4">
      ├─ <Input placeholder="상품명 또는 바코드 검색..." />  // Search
      │
      └─ <div className="space-y-2">  // Product List
          {filteredProducts.map(product => (
            <Card key={product.id}>
              ├─ <CardHeader>
              │   ├─ <CardTitle> {product.name} </CardTitle>
              │   └─ <Badge> {product.category} </Badge>
              │
              ├─ <CardContent>
              │   ├─ 바코드: {product.barcode}
              │   ├─ 가격: {product.sellPrice.toLocaleString()}원
              │   ├─ 센터 재고: {centerStock}개
              │   └─ 전체 재고: {product.totalStock}개
              │
              └─ <CardFooter>
                  └─ <Button> 방송 추가 </Button>
            </Card>
          ))}
      </div>
```

**Implementation**:
```typescript
// components/broadcasts/ProductListForBroadcast.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

interface ProductWithStock {
  id: string;
  code: string;
  barcode: string;
  name: string;
  category: string | null;
  sellPrice: number;
  totalStock: number;
  centerStocks: {
    stock: number;
    centerId: string;
  }[];
  warehouseInventory: {
    warehouseId: string;
    quantity: number;
  }[];
}

interface ProductListForBroadcastProps {
  products: ProductWithStock[];
  centerId: string;
}

export function ProductListForBroadcast({
  products,
  centerId,
}: ProductListForBroadcastProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.barcode.includes(query) ||
        product.code.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const getCenterStock = (product: ProductWithStock) => {
    const centerStock = product.centerStocks.find(
      (cs) => cs.centerId === centerId
    );
    return centerStock?.stock || 0;
  };

  const isLowStock = (stock: number) => stock < 10;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="상품명 또는 바코드 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Product Count */}
      <div className="text-sm text-muted-foreground">
        {filteredProducts.length}개 상품{searchQuery && ' (검색 결과)'}
      </div>

      {/* Product List */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            검색 결과가 없습니다
          </div>
        ) : (
          filteredProducts.map((product) => {
            const centerStock = getCenterStock(product);
            const lowStock = isLowStock(centerStock);

            return (
              <Card key={product.id} className={lowStock ? 'border-orange-500' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    {product.category && (
                      <Badge variant="secondary">{product.category}</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">바코드:</span>{' '}
                      {product.barcode}
                    </div>
                    <div>
                      <span className="text-muted-foreground">가격:</span>{' '}
                      {product.sellPrice.toLocaleString()}원
                    </div>
                    <div>
                      <span className="text-muted-foreground">센터 재고:</span>{' '}
                      <span className={lowStock ? 'text-orange-600 font-semibold' : ''}>
                        {centerStock}개
                      </span>
                      {lowStock && (
                        <Badge variant="destructive" className="ml-2">
                          부족
                        </Badge>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">전체 재고:</span>{' '}
                      {product.totalStock}개
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-3">
                  <Button className="w-full" disabled={centerStock === 0}>
                    {centerStock === 0 ? '재고 없음' : '방송 추가'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
```

---

### Phase 4.2: BroadcastSalesTracker Component

**File**: `components/broadcasts/BroadcastSalesTracker.tsx`

**Purpose**: 실시간 판매 현황 트래킹

**Props Interface**:
```typescript
interface BroadcastSalesTrackerProps {
  broadcastId: string;
  refreshInterval?: number; // milliseconds, default: 5000
}
```

**Stats Interface**:
```typescript
interface BroadcastStats {
  totalSales: number;        // 총 매출액
  totalOrders: number;       // 총 주문 수
  totalQuantity: number;     // 총 판매 수량
  topProducts: {             // 상위 판매 상품 (TOP 5)
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
  recentOrders: {            // 최근 주문 (최근 5개)
    id: string;
    productName: string;
    quantity: number;
    amount: number;
    createdAt: string;
  }[];
}
```

**Component Structure**:
```tsx
<BroadcastSalesTracker>
  └─ <div className="space-y-4">
      ├─ <Card> 총 매출액
      ├─ <Card> 총 주문 수
      ├─ <Card> 총 판매 수량
      │
      ├─ <Card> 상위 판매 상품 TOP 5
      │   └─ <ul> {topProducts.map(...)} </ul>
      │
      └─ <Card> 최근 주문
          └─ <ul> {recentOrders.map(...)} </ul>
```

**Implementation**:
```typescript
// components/broadcasts/BroadcastSalesTracker.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ShoppingCart, Package, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface BroadcastStats {
  totalSales: number;
  totalOrders: number;
  totalQuantity: number;
  topProducts: {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
  recentOrders: {
    id: string;
    productName: string;
    quantity: number;
    amount: number;
    createdAt: string;
  }[];
}

interface BroadcastSalesTrackerProps {
  broadcastId: string;
  refreshInterval?: number;
}

export function BroadcastSalesTracker({
  broadcastId,
  refreshInterval = 5000,
}: BroadcastSalesTrackerProps) {
  const [stats, setStats] = useState<BroadcastStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}/stats`);
      const data = await res.json();

      if (data.success) {
        setStats(data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch broadcast stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [broadcastId, refreshInterval]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        통계를 불러올 수 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Update Indicator */}
      {lastUpdated && (
        <div className="text-xs text-muted-foreground text-right">
          {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: ko })} 업데이트
        </div>
      )}

      {/* Stats Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 매출액</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.totalSales.toLocaleString()}원
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 주문 수</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalOrders}건</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 판매 수량</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalQuantity}개</div>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">상위 판매 상품 TOP 5</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topProducts.length === 0 ? (
            <div className="text-sm text-muted-foreground">아직 판매된 상품이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {stats.topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{index + 1}</Badge>
                    <span className="font-medium">{product.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {product.revenue.toLocaleString()}원
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {product.quantity}개
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">최근 주문</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentOrders.length === 0 ? (
            <div className="text-sm text-muted-foreground">아직 주문이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {stats.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-start justify-between text-sm border-b pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium">{order.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.quantity}개 ·{' '}
                      {formatDistanceToNow(new Date(order.createdAt), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </div>
                  </div>
                  <div className="font-medium">
                    {order.amount.toLocaleString()}원
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Dependencies**:
- `date-fns` - Date formatting (already installed)
- `date-fns/locale/ko` - Korean locale (already installed)

---

## 📁 File Structure

```
live-commerce/
├── app/
│   ├── api/
│   │   ├── centers/
│   │   │   ├── validate-code/
│   │   │   │   └── route.ts                    ✅ CREATE (Phase 4.1)
│   │   │   └── check-available/
│   │   │       └── route.ts                    ✅ CREATE (Phase 4.1)
│   │   │
│   │   └── broadcasts/
│   │       ├── [id]/
│   │       │   ├── start/
│   │       │   │   └── route.ts                🔧 MODIFY (Phase 4.1)
│   │       │   └── stats/
│   │       │       └── route.ts                ✅ CREATE (Phase 4.2)
│   │
│   └── (main)/
│       └── broadcasts/
│           ├── page.tsx                        🔧 MODIFY (Phase 4.1 - add dialog)
│           └── [id]/
│               └── live/
│                   ├── page.tsx                🔧 MODIFY (Phase 4.2 - already exists)
│                   └── components/
│                       ├── ProductListForBroadcast.tsx   ✅ CREATE (Phase 4.2)
│                       └── BroadcastSalesTracker.tsx    ✅ CREATE (Phase 4.2)
│
├── components/
│   └── broadcasts/
│       └── StartBroadcastDialog.tsx            ✅ CREATE (Phase 4.1)
│
├── lib/
│   └── services/
│       ├── center/
│       │   └── centerService.ts                ✅ EXISTS (validateCenterCode, getCenterByCode)
│       └── broadcast/
│           └── broadcastService.ts             ✅ CREATE (Phase 4.1)
│
└── docs/
    ├── 01-plan/features/
    │   └── phase-4-broadcast-calendar.plan.md  ✅ EXISTS
    └── 02-design/features/
        └── phase-4-broadcast-calendar.design.md ✅ THIS FILE
```

**File Count**:
- ✅ CREATE: 7 files
- 🔧 MODIFY: 3 files
- Total: 10 files

---

## 🔄 Data Flow Sequence

### Sequence 1: 센터코드 검증 및 방송 시작

```
User                StartBroadcastDialog           API                      Database
  │                         │                        │                          │
  │  Click "방송 시작"       │                        │                          │
  ├──────────────────────>  │                        │                          │
  │                         │                        │                          │
  │                         │  Open Dialog           │                          │
  │                         │                        │                          │
  │  Input "01-4213"        │                        │                          │
  ├──────────────────────>  │                        │                          │
  │                         │                        │                          │
  │  Click "확인"           │                        │                          │
  ├──────────────────────>  │                        │                          │
  │                         │                        │                          │
  │                         │  POST /validate-code   │                          │
  │                         ├───────────────────────>│                          │
  │                         │                        │                          │
  │                         │                        │  validateCenterCode()    │
  │                         │                        ├─────────────────────────>│
  │                         │                        │                          │
  │                         │                        │  getCenterByCode()       │
  │                         │                        ├─────────────────────────>│
  │                         │                        │                          │
  │                         │                        │  SELECT * FROM Center    │
  │                         │                        │<─────────────────────────┤
  │                         │                        │                          │
  │                         │  { center, valid }     │                          │
  │                         │<───────────────────────┤                          │
  │                         │                        │                          │
  │  Display Center Info    │                        │                          │
  │<────────────────────────┤                        │                          │
  │                         │                        │                          │
  │  Click "방송 시작"       │                        │                          │
  ├──────────────────────>  │                        │                          │
  │                         │                        │                          │
  │                         │  POST /broadcasts/     │                          │
  │                         │       [id]/start       │                          │
  │                         ├───────────────────────>│                          │
  │                         │                        │                          │
  │                         │                        │  startBroadcast()        │
  │                         │                        ├─────────────────────────>│
  │                         │                        │                          │
  │                         │                        │  UPDATE Broadcast        │
  │                         │                        │  SET centerId, status    │
  │                         │                        │<─────────────────────────┤
  │                         │                        │                          │
  │                         │  { broadcast }         │                          │
  │                         │<───────────────────────┤                          │
  │                         │                        │                          │
  │  Redirect to /live      │                        │                          │
  │<────────────────────────┤                        │                          │
  │                         │                        │                          │
```

### Sequence 2: 센터별 상품 로드

```
User              LiveBroadcastPage              Database
  │                      │                           │
  │  Navigate to         │                           │
  │  /broadcasts/[id]/   │                           │
  │  live?centerId=xxx   │                           │
  ├─────────────────────>│                           │
  │                      │                           │
  │                      │  Get Broadcast            │
  │                      ├──────────────────────────>│
  │                      │                           │
  │                      │  SELECT * FROM Broadcast  │
  │                      │  WHERE id = [id]          │
  │                      │<──────────────────────────┤
  │                      │                           │
  │                      │  Get Center Products      │
  │                      ├──────────────────────────>│
  │                      │                           │
  │                      │  SELECT * FROM Product    │
  │                      │  JOIN ProductCenterStock  │
  │                      │  WHERE centerId = [xxx]   │
  │                      │<──────────────────────────┤
  │                      │                           │
  │                      │  Get HQ Products          │
  │                      ├──────────────────────────>│
  │                      │                           │
  │                      │  SELECT * FROM Product    │
  │                      │  WHERE active = true      │
  │                      │<──────────────────────────┤
  │                      │                           │
  │  Render Product List │                           │
  │<─────────────────────┤                           │
  │                      │                           │
```

---

## 🧪 Testing Plan

### Unit Tests

#### Test 1: validateCenterCode Function
```typescript
// tests/unit/services/center/validateCenterCode.test.ts

describe('validateCenterCode', () => {
  it('should return invalid for incorrect format', async () => {
    const result = await validateCenterCode('123');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Invalid format');
  });

  it('should return available for valid unused code', async () => {
    const result = await validateCenterCode('99-9999');
    expect(result.valid).toBe(true);
    expect(result.available).toBe(true);
  });

  it('should return unavailable for existing code', async () => {
    // Assume '01-4213' exists
    const result = await validateCenterCode('01-4213');
    expect(result.valid).toBe(true);
    expect(result.available).toBe(false);
  });
});
```

#### Test 2: StartBroadcastDialog Component
```typescript
// tests/unit/components/StartBroadcastDialog.test.tsx

describe('StartBroadcastDialog', () => {
  it('should render dialog trigger button', () => {
    render(<StartBroadcastDialog broadcastId="test-id" />);
    expect(screen.getByText('방송 시작')).toBeInTheDocument();
  });

  it('should validate center code on button click', async () => {
    render(<StartBroadcastDialog broadcastId="test-id" />);

    fireEvent.click(screen.getByText('방송 시작'));
    fireEvent.change(screen.getByPlaceholderText('예: 01-4213'), {
      target: { value: '01-4213' },
    });
    fireEvent.click(screen.getByText('확인'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/centers/validate-code', {
        method: 'POST',
        body: JSON.stringify({ code: '01-4213' }),
      });
    });
  });
});
```

### Integration Tests

#### Test 3: POST /api/centers/validate-code
```typescript
// tests/integration/api/centers/validate-code.test.ts

describe('POST /api/centers/validate-code', () => {
  it('should return 401 for unauthenticated request', async () => {
    const res = await fetch('/api/centers/validate-code', {
      method: 'POST',
      body: JSON.stringify({ code: '01-4213' }),
    });
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-MASTER user', async () => {
    // Login as SELLER
    const res = await authenticatedFetch('SELLER', '/api/centers/validate-code', {
      method: 'POST',
      body: JSON.stringify({ code: '01-4213' }),
    });
    expect(res.status).toBe(403);
  });

  it('should validate center code for MASTER user', async () => {
    const res = await authenticatedFetch('MASTER', '/api/centers/validate-code', {
      method: 'POST',
      body: JSON.stringify({ code: '99-9999' }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.valid).toBe(true);
  });
});
```

### E2E Tests (Playwright)

#### Test 4: 방송 시작 플로우
```typescript
// tests/e2e/broadcasts/start-broadcast.spec.ts

test('should start broadcast with center code', async ({ page }) => {
  // 1. Login as SELLER
  await page.goto('/login');
  await page.fill('[name="email"]', 'seller@test.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // 2. Navigate to broadcasts
  await page.goto('/broadcasts');

  // 3. Click "방송 시작" button
  await page.click('text=방송 시작');

  // 4. Enter center code
  await page.fill('[placeholder="예: 01-4213"]', '01-4213');
  await page.click('text=확인');

  // 5. Wait for center validation
  await page.waitForSelector('text=센터 확인됨');

  // 6. Start broadcast
  await page.click('button:has-text("방송 시작")');

  // 7. Verify redirect to live page
  await page.waitForURL(/\/broadcasts\/.*\/live\?centerId=/);
  await expect(page.locator('text=라이브 방송')).toBeVisible();
});
```

### Performance Tests

#### Test 5: 상품 로드 시간
```typescript
// tests/performance/broadcast-live-load.test.ts

test('should load 100 products in under 2 seconds', async () => {
  const start = Date.now();

  const res = await fetch('/broadcasts/test-id/live?centerId=test-center');
  await res.text();

  const duration = Date.now() - start;
  expect(duration).toBeLessThan(2000);
});
```

---

## ✅ Implementation Checklist

### Phase 4.1: 방송 시작 시 센터코드 입력

- [ ] **Day 1-2: API 엔드포인트**
  - [ ] Create `app/api/centers/validate-code/route.ts`
  - [ ] Create `app/api/centers/check-available/route.ts`
  - [ ] Test with curl/Postman
  - [ ] Verify RBAC (MASTER only)

- [ ] **Day 3-4: UI 컴포넌트**
  - [ ] Create `components/broadcasts/StartBroadcastDialog.tsx`
  - [ ] Implement state management (centerCode, isValidating, center, error)
  - [ ] Add keyboard navigation (Enter key validation)
  - [ ] Test error scenarios (invalid code, network error)

- [ ] **Day 5: 통합 및 테스트**
  - [ ] Integrate StartBroadcastDialog into `/broadcasts/page.tsx`
  - [ ] Modify `app/api/broadcasts/[id]/start/route.ts` to accept centerId
  - [ ] Create `lib/services/broadcast/broadcastService.ts`
  - [ ] Write E2E test (센터코드 입력 → 검증 → 방송 시작)

### Phase 4.2: 센터별 상품 동적 로드

- [ ] **Day 6-7: 라이브 방송 페이지**
  - [ ] Modify `app/(main)/broadcasts/[id]/live/page.tsx`
  - [ ] Add centerId validation (redirect if missing)
  - [ ] Implement center products query
  - [ ] Implement HQ products query
  - [ ] Merge products and pass to components

- [ ] **Day 8: ProductListForBroadcast**
  - [ ] Create `components/broadcasts/ProductListForBroadcast.tsx`
  - [ ] Implement search functionality (useState + useMemo)
  - [ ] Add low stock indicator (<10개 badge)
  - [ ] Style with Card components

- [ ] **Day 9: BroadcastSalesTracker**
  - [ ] Create `components/broadcasts/BroadcastSalesTracker.tsx`
  - [ ] Create `app/api/broadcasts/[id]/stats/route.ts`
  - [ ] Implement polling mechanism (5초 간격)
  - [ ] Display stats cards (매출액, 주문 수, 판매 수량)
  - [ ] Display top products and recent orders

- [ ] **Day 10: 통합 테스트**
  - [ ] Test full flow (센터코드 → 상품 로드 → 판매 트래킹)
  - [ ] Performance test (상품 로드 < 2초)
  - [ ] Mobile responsive test
  - [ ] Error handling test

---

## 📊 Success Metrics

### Functional Metrics
- [ ] 센터코드 검증 성공률 > 99%
- [ ] 방송 시작 성공률 > 95%
- [ ] 상품 로드 성공률 > 99%

### Performance Metrics
- [ ] API 응답 시간 < 500ms (p95)
- [ ] 상품 로드 시간 < 2초 (100개 상품)
- [ ] 판매 현황 업데이트 지연 < 5초

### Quality Metrics
- [ ] TypeScript 컴파일 에러 0개
- [ ] ESLint 경고 0개
- [ ] Unit test coverage > 80%
- [ ] E2E test 통과율 100%

---

## 🔗 Dependencies

### External Dependencies (No new packages)
All required packages already exist in the project:
- Next.js 16.2.2
- React 19
- Prisma 7.6
- shadcn/ui components
- lucide-react
- date-fns
- sonner

### Internal Dependencies
- ✅ Phase 1.1: Center model and schema
- ✅ Phase 1.2: Center service layer (`validateCenterCode`, `getCenterByCode`)
- ✅ Phase 1.3: Center UI components (not directly used, but pattern reference)

---

## 🎯 Next Steps

1. **Implementation**: Start with Phase 4.1 (센터코드 입력)
2. **Review**: Code review after each component completion
3. **Testing**: Write tests in parallel with implementation
4. **Documentation**: Update API docs and user guides
5. **Deployment**: Deploy after all tests pass

**Command to start implementation**:
```bash
/pdca do phase-4-broadcast-calendar
```

---

**Design Document Version**: 1.0
**Last Updated**: 2026-04-15
**Status**: Ready for Implementation
