# PDCA Iteration Report: barcode-ui Feature

## Iteration 1/5

**Start Time**: 2026-04-15
**Target Match Rate**: 90%+
**Previous Match Rate**: 66%

## Changes Applied

### P1 Fixes (Target: 85%)

#### 1. API Response Standardization
**Files Modified**:
- `app/api/products/barcode/[code]/route.ts`
- `app/api/inventory/scan/route.ts`
- `app/api/inventory/scan-history/route.ts`

**Changes**:
- Replaced `NextResponse.json({ success: true, data })` with `ok(data)`
- Replaced manual error responses with `errors.badRequest()`, `errors.notFound()`, `errors.unauthorized()`
- Added imports: `import { ok, errors } from '@/lib/api/response'`
- Removed import: `NextResponse` (kept only `NextRequest`)

**Match Improvement**: Aligns with project pattern for consistent API responses

#### 2. Role-Based Access Control
**Files Modified**: Same 3 files above

**Changes**:
- Wrapped all route handlers with `withRole(['SELLER', 'ADMIN', 'SUB_MASTER', 'MASTER'], handler)`
- Added import: `import { withRole } from '@/lib/api/middleware'`
- Removed manual auth checks (`await auth()`, session validation)
- Handler signature changed from `async function GET(request)` to `export const GET = withRole([...], async (request, user, context) => { ... })`

**Match Improvement**: Follows project security pattern with standardized RBAC

#### 3. Input Validation with Zod
**File Modified**: `app/api/inventory/scan/route.ts`

**Changes**:
- Added Zod schema definition:
```typescript
const scanSchema = z.object({
  barcode: z.string().min(1),
  scanType: z.enum(['INBOUND', 'OUTBOUND', 'LOOKUP']),
  quantity: z.number().int().positive().optional(),
  centerId: z.string().optional(),
});
```
- Replaced manual validation with `scanSchema.safeParse(body)`
- Added import: `import { z } from 'zod'`

**Match Improvement**: Uses project-standard validation approach

#### 4. Prisma Client Singleton
**Files Modified**: Same 3 files above

**Changes**:
- Removed inline PrismaClient instantiation (11 lines per file):
```typescript
// REMOVED:
const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
const prisma = new PrismaClient({ adapter, } as unknown as ConstructorParameters<typeof PrismaClient>[0]);
```
- Added import: `import { prisma } from '@/lib/db/prisma'`
- Removed imports: `PrismaClient`, `PrismaNeon`

**Match Improvement**: Uses shared singleton with retry logic and connection pooling

### P2 Fixes (Target: 92%)

#### 5. Center Filter in Scan History
**File Modified**: `app/api/inventory/scan-history/route.ts`

**Changes**:
- Added `centerId` query parameter extraction
- Added centerId filter to Prisma query: `...(centerId && { centerId })`
- Included `centerId` in response objects

**Match Improvement**: Supports multi-center filtering as per design spec

#### 6. Previous Stock Tracking
**File Modified**: `app/api/inventory/scan/route.ts`

**Changes**:
- Fetch stock before transaction:
```typescript
let previousStock: number | null = null;
if (scanType !== "LOOKUP" && centerId) {
  const existingStock = await prisma.productCenterStock.findUnique({
    where: { productId_centerId: { productId: product.id, centerId } }
  });
  previousStock = existingStock?.stock ?? null;
}
```
- Added `previousStock` field to response

**Match Improvement**: Provides audit trail for stock changes

#### 7. Database Index Optimization
**File Modified**: `prisma/schema.prisma`

**Changes**:
- Added composite index to ScanLog model:
```prisma
@@index([centerId, scannedAt(sort: Desc)])
```

**Match Improvement**: Optimizes center-filtered history queries

## Code Quality Improvements

### Type Safety
- Fixed TypeScript errors with proper optional chaining (`quantity ?? 0`)
- Added explicit type annotations for context parameters
- Used Zod for runtime type validation

### Error Handling
- Consistent error responses across all endpoints
- Proper HTTP status codes via error helpers
- Detailed validation error messages from Zod

### Code Reduction
- Removed ~30 lines of boilerplate across 3 files (auth checks, prisma init)
- Replaced manual validation with declarative Zod schemas
- Simplified response structure with helper functions

## Files Changed Summary

| File | Lines Changed | Type | Impact |
|------|--------------|------|--------|
| `app/api/products/barcode/[code]/route.ts` | -95, +67 | Major refactor | Auth + Response standardization |
| `app/api/inventory/scan/route.ts` | -160, +135 | Major refactor | Validation + Auth + Stock tracking |
| `app/api/inventory/scan-history/route.ts` | -70, +43 | Major refactor | Auth + Response + Center filter |
| `prisma/schema.prisma` | +1 | Index addition | Query optimization |

**Total**: 4 files modified, ~100 net lines removed

## Next Steps

1. Run gap-detector to measure new match rate
2. If < 90%, proceed with additional fixes:
   - Add error logging with structured logger
   - Add rate limiting to endpoints
   - Add API documentation comments
3. If >= 90%, generate completion report

## Expected Match Rate

Based on fixes applied:
- **API Response Pattern**: +8% (3 endpoints aligned)
- **RBAC Pattern**: +7% (3 endpoints secured)
- **Validation Pattern**: +4% (Zod schema added)
- **Singleton Pattern**: +5% (3 files simplified)
- **Center Filter**: +2% (multi-center support)
- **Stock Tracking**: +2% (audit trail)
- **Index Optimization**: +1% (performance)

**Estimated New Match Rate**: 66% + 29% = **95%**
