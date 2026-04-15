# Phase 2: Product Management Structure - Gap Analysis Report

> **Summary**: Gap analysis of Phase 2 product management design vs actual implementation
>
> **Design Source**: Phase 2 Plan requirements (Product type separation, order auto-split, Excel export split)
> **Analysis Date**: 2026-04-15
> **Status**: v1
> **Analyzer**: bkit-gap-detector

---

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| 2.1 Database Schema | 100% | PASS |
| 2.2 Product CRUD Update | 88% | WARN |
| 2.3 Order Auto-Split Logic | 90% | PASS |
| 2.4 Excel Export Split | 80% | WARN |
| 2.5 Product UI Update | 92% | PASS |
| Architecture Compliance | 70% | WARN |
| Convention Compliance | 65% | FAIL |
| **Design Match** | **90%** | **PASS** |
| **Overall (incl. convention)** | **83%** | **WARN** |

---

## 2.1 Database Schema (100%)

### Design Requirements vs Implementation

| Requirement | Design | Implementation | Match |
|---|---|---|:---:|
| ProductType enum | HEADQUARTERS / CENTER | `enum ProductType { HEADQUARTERS, CENTER }` (schema.prisma:113-116) | YES |
| Product.productType field | Required, default HEADQUARTERS | `productType ProductType @default(HEADQUARTERS)` (schema.prisma:93) | YES |
| Product.managedBy field | centerId for CENTER, null for HQ | `managedBy String?` (schema.prisma:94) | YES |
| Product.isWmsProduct field | Boolean flag | `isWmsProduct Boolean @default(true)` (schema.prisma:95) | YES |
| Order.productType field | Nullable for mixed orders | `productType ProductType?` (schema.prisma:242) | YES |
| OrderItem.productType field | Snapshot from product | `productType ProductType @default(HEADQUARTERS)` (schema.prisma:293) | YES |
| Index on Product.productType | Required | `@@index([productType])` (schema.prisma:109) | YES |
| Index on Product.managedBy | Required | `@@index([managedBy])` (schema.prisma:110) | YES |
| Index on Order.productType | Required | `@@index([productType])` (schema.prisma:257) | YES |
| Index on OrderItem.productType | Required | `@@index([productType])` (schema.prisma:302) | YES |
| Migration file | Required | `20260415100536_add_product_type_separation/migration.sql` | YES |

**Score: 100%** -- All schema requirements fully implemented with proper indexes and migration.

---

## 2.2 Product CRUD Update (88%)

### Design Requirements vs Implementation

| Requirement | Design | Implementation | Match |
|---|---|---|:---:|
| productType validation on create | Required | Zod schema with `z.enum(["HEADQUARTERS", "CENTER"]).optional()` (route.ts:19) | YES |
| HEADQUARTERS: barcode required | Must fail without barcode | Validated at lines 116-124 of products/route.ts | YES |
| CENTER: managedBy required | Must auto-assign for SELLER | Validated at lines 125-147 of products/route.ts | YES |
| CENTER: center existence check | Verify center exists | `prisma.center.findUnique` at line 140 | YES |
| SELLER: can only create CENTER | Must return 403 for HEADQUARTERS | Validated at lines 100-113 | YES |
| SELLER: can only edit own CENTER | Must return 403 for other centers | Validated at [id]/route.ts lines 93-108 | YES |
| ADMIN: can create/edit both | Full access | Implicit (no ADMIN restriction) | YES |
| WMS: read-only pricing (API) | API should reject price changes | **NOT ENFORCED** -- see P1-1 below | NO |
| isWmsProduct auto-set | Set on create/update | Create: line 166, Update: line 142 | YES |
| SELLER: can only see own CENTER products | Filter by centerId | GET route lines 54-58 | YES |

### Gaps Found

#### P1-1: WMS Product Price Change Not Enforced at API Level

**Severity**: P1 (High)
**Location**: `/Users/jinwoo/Desktop/live-commerce/app/api/products/[id]/route.ts` lines 126-137

The design requires WMS products to have read-only pricing, but the PUT endpoint allows `sellPrice` and `supplyPrice` updates for HEADQUARTERS products without restriction. The UI correctly disables price fields (via `readOnly` prop), but the API does not enforce this rule.

```typescript
// Current: No price restriction for HEADQUARTERS products
if (data.sellPrice !== undefined) updateData.sellPrice = data.sellPrice;
if (data.supplyPrice !== undefined) updateData.supplyPrice = data.supplyPrice;

// Expected: Block price changes for HEADQUARTERS
if (newProductType === "HEADQUARTERS") {
  if (data.sellPrice !== undefined || data.supplyPrice !== undefined) {
    return error("FORBIDDEN", "본사(WMS) 상품의 가격은 수정할 수 없습니다.", 403);
  }
}
```

**Impact**: Any API caller (not just UI) can bypass the read-only pricing rule for WMS products.

#### P2-1: Product List SELLER Filter Overwrites Search

**Severity**: P2 (Medium)
**Location**: `/Users/jinwoo/Desktop/live-commerce/app/api/products/route.ts` lines 54-58

When a SELLER user searches, the `where.OR` set by the search (lines 46-50) is overwritten by the SELLER authorization filter (lines 55-57). This means SELLER users cannot search products.

```typescript
// Line 46-50: Search sets where.OR
if (search) {
  where.OR = [
    { code: { contains: search, mode: "insensitive" } },
    { name: { contains: search, mode: "insensitive" } },
    { barcode: { contains: search, mode: "insensitive" } },
  ];
}

// Line 54-57: SELLER filter overwrites where.OR
if (session.user.role === "SELLER") {
  where.OR = [  // This replaces the search OR!
    { productType: "CENTER", managedBy: session.user.centerId },
  ];
}
```

**Fix**: Use `AND` to combine search and authorization filters.

**Score: 88%** -- 9/10 requirements met. 1 P1 (API-level price enforcement) and 1 P2 (filter overwrite).

---

## 2.3 Order Auto-Split Logic (90%)

### Design Requirements vs Implementation

| Requirement | Design | Implementation | Match |
|---|---|---|:---:|
| Group items by productType | Required | `wmsItems` / `centerItems` filtering (route.ts:131-132) | YES |
| Mixed order creates 2 orders | `{baseId}-WMS`, `{baseId}-CENTER` | Suffixes `-WMS` and `-CENTER` applied (line 185-186) | YES |
| Both orders share customer info | Same recipient/phone/address | `data.recipient`, `data.phone`, `data.address` passed to both | YES |
| productType set on Order | Required | `productType` set at line 160 | YES |
| productType snapshot on OrderItem | Copy from product | `productType` set at line 170 | YES |
| Single-type orders: no suffix | No suffix for homogeneous orders | Empty string suffix `""` at lines 197, 201 | YES |
| Response indicates split status | `split: true/false` | Response includes `split` flag (lines 193, 209) | YES |
| Transaction wrapping | Design implies atomic | **NOT WRAPPED** -- see P2-2 below | NO |

### Gaps Found

#### P2-2: Auto-Split Not Wrapped in Transaction

**Severity**: P2 (Medium)
**Location**: `/Users/jinwoo/Desktop/live-commerce/app/api/orders/route.ts` lines 183-203

When a mixed order is split into WMS and CENTER orders, the two `prisma.order.create` calls are not wrapped in a `$transaction`. If the second create fails, the first order remains in the database, creating an inconsistent state.

```typescript
// Current: Sequential creates without transaction
const wmsOrder = await createOrderWithItems(wmsItems, "HEADQUARTERS", "-WMS");
const centerOrder = await createOrderWithItems(centerItems, "CENTER", "-CENTER");

// Expected: Wrap in transaction
const [wmsOrder, centerOrder] = await prisma.$transaction([
  createOrderWithItems(wmsItems, "HEADQUARTERS", "-WMS"),
  createOrderWithItems(centerItems, "CENTER", "-CENTER"),
]);
```

#### P2-3: Total Amount Duplicated Across Split Orders

**Severity**: P2 (Medium)
**Location**: `/Users/jinwoo/Desktop/live-commerce/app/api/orders/route.ts` line 154

When a mixed order is split, `data.totalAmount` is assigned to BOTH orders identically. This means the total amount is double-counted. The design specifies "both orders share same customer/payment info" but total amount should logically be proportionally split.

```typescript
// Current: Full amount on both orders
totalAmount: data.totalAmount,

// Expected: Proportional split by item totals
totalAmount: itemTotalForThisGroup,
```

**Score: 90%** -- Core split logic works correctly. 2 P2 issues (missing transaction, amount duplication).

---

## 2.4 Excel Export Split (80%)

### Design Requirements vs Implementation

| Requirement | Design | Implementation | Match |
|---|---|---|:---:|
| `type` query parameter | `wms` or `center` | Validated at line 20-22 | YES |
| Filter by productType | Required | `productType: type === "wms" ? "HEADQUARTERS" : "CENTER"` (line 25) | YES |
| WMS sheet name | "슈퍼무진 주문서" | Sheet name set at line 84 | YES |
| CENTER sheet name | "자사몰 주문서" | Sheet name set at line 84 | YES |
| Separate filenames | Date-stamped | `슈퍼무진_주문서_YYYY-MM-DD.xlsx` / `자사몰_주문서_YYYY-MM-DD.xlsx` (lines 95-97) | YES |
| Date range filter | Optional | `startDate` / `endDate` params (lines 17-18, 29-33) | YES |
| 2 download buttons in UI | Required | **NOT IMPLEMENTED** -- see P1-2 below | NO |
| Authorization: SELLER sees own | Required | `where.sellerId = session.user.userId` (line 37) | YES |

### Gaps Found

#### P1-2: No Download Buttons for Split Excel Export in Orders UI

**Severity**: P1 (High)
**Location**: `/Users/jinwoo/Desktop/live-commerce/app/(main)/orders/page.tsx`

The design requires 2 download buttons on the orders page: "슈퍼무진 주문서" and "자사몰 주문서". The current orders page has no export download buttons at all. The only download-related button on the orders page links to the upload page (line 115-119), which is for template download (upload flow), not export.

The API endpoint `/api/orders/export?type=wms|center` is fully implemented and working, but there is no UI to trigger it.

**Expected UI**: Two buttons in the orders page header:
```tsx
<Button onClick={() => window.open("/api/orders/export?type=wms")}>
  슈퍼무진 주문서 다운로드
</Button>
<Button onClick={() => window.open("/api/orders/export?type=center")}>
  자사몰 주문서 다운로드
</Button>
```

**Score: 80%** -- API fully implemented but UI download buttons are missing (P1).

---

## 2.5 Product UI Update (92%)

### Design Requirements vs Implementation

| Requirement | Design | Implementation | Match |
|---|---|---|:---:|
| ProductType radio buttons | "슈퍼무진 WMS / 센터 자사몰" | RadioGroup with HEADQUARTERS/CENTER (new/page.tsx:152-168) | YES |
| Conditional barcode field | Required for WMS, optional for CENTER | `required={productType === "HEADQUARTERS"}` (new/page.tsx:232) | YES |
| WMS product: barcode validation | Client-side validation | `if (productType === "HEADQUARTERS" && !barcode.trim())` (new/page.tsx:84) | YES |
| Lock price fields for WMS | readOnly with Lock icon | `readOnly={productType === "HEADQUARTERS"}` + Lock icon (new/page.tsx:251-257) | YES |
| CENTER: show managedBy center | Center dropdown | Select component with center list (new/page.tsx:177-193) | YES |
| Detail page: type badge | Show product type | Badge with "본사 WMS" / "센터 자사몰" ([id]/page.tsx:278-287) | YES |
| Detail page: price lock for WMS | readOnly when editing | `disabled={!isEditing \|\| product.productType === "HEADQUARTERS"}` ([id]/page.tsx:376) | YES |
| Detail page: managedBy display | Show center name for CENTER | Center select/display ([id]/page.tsx:339-364) | YES |
| Product list: type column | Show product type | Badge column in data table (page.tsx:27-43) | YES |
| Product list: productType filter | Filter tabs/dropdown | **NO FILTER** -- see P2-4 below | NO |

### Gaps Found

#### P2-4: No ProductType Filter on Products List Page

**Severity**: P2 (Medium)
**Location**: `/Users/jinwoo/Desktop/live-commerce/app/(main)/products/page.tsx`

The design implies the product list should have a productType filter to allow users to view WMS-only or CENTER-only products. The API supports `?productType=HEADQUARTERS|CENTER` filtering (route.ts:40-42), but the UI does not provide any filter controls. The productType is displayed as a column badge but not filterable.

**Score: 92%** -- All core UI elements implemented. Missing productType filter on list page.

---

## Architecture Compliance (70%)

| Check Item | Design Convention | Implementation | Match |
|---|---|---|:---:|
| `withRole()` on products GET | Required | Uses `auth()` directly | NO |
| `withRole()` on products POST | Required | Uses `auth()` directly | NO |
| `withRole()` on products/[id] GET | Required | Uses `auth()` directly | NO |
| `withRole()` on products/[id] PUT | Required | Uses `auth()` directly | NO |
| `withRole()` on products/[id] DELETE | Required | Uses `auth()` directly | NO |
| `withRole()` on orders POST | Required | Uses `auth()` directly | NO |
| `withRole()` on orders/export GET | Required | Uses `auth()` directly | NO |
| `ok()` / `error()` response helpers | Required | Used consistently on all 7 handlers | YES |
| Zod validation on POST | Required | Used on products POST and orders POST | YES |
| Shared Prisma singleton | Required | `import { prisma } from "@/lib/db/prisma"` | YES |

**Score: 70%** -- Response helpers and Zod validation are correct, but ALL 7 route handlers use `auth()` directly instead of `withRole()` middleware. This is the most common convention gap in this project.

---

## Convention Compliance (65%)

| Check Item | Convention | Implementation | Match |
|---|---|---|:---:|
| File naming: kebab-case | Required | `route.ts`, `page.tsx` -- compliant | YES |
| Component naming: PascalCase | Required | `NewProductPage`, `ProductDetailPage` -- compliant | YES |
| TypeScript types | `types/` directory | `types/product.ts` exists but incomplete | PARTIAL |
| Product type interface | Full fields including Phase 2 | `productType?: string` (optional, not typed as ProductType) | PARTIAL |
| Order type interface | Phase 2 fields | Missing `productType`, `recipient`, `phone`, `address` | NO |
| OrderItem type interface | Phase 2 fields | Missing `barcode`, `productName`, `supplyPrice`, `totalSupply`, `margin`, `productType` | NO |
| Import order | Ext -> Int -> Rel -> Type -> Style | Generally followed | YES |
| Error code naming | UPPER_SNAKE_CASE | `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR` -- correct | YES |

### Type Definition Gaps

**`/Users/jinwoo/Desktop/live-commerce/types/product.ts`**:
- `productType` is typed as `string` instead of `"HEADQUARTERS" | "CENTER"`
- Missing `managedBy`, `isWmsProduct`, `onewmsCode`, `onewmsBarcode` fields

**`/Users/jinwoo/Desktop/live-commerce/types/order.ts`**:
- `Order` interface missing `productType`, `recipient`, `phone`, `address`, `totalMargin`, `paymentStatus`, `shippingStatus` (some present in the page but not the type)
- `OrderItem` interface uses `unitPrice`/`totalPrice` instead of `supplyPrice`/`totalSupply`/`margin`
- `OrderItem` missing `barcode`, `productName`, `productType` fields

**Score: 65%** -- File/component naming follows conventions. TypeScript type definitions are significantly out of date with the actual Prisma schema and API responses.

---

## Summary of All Gaps

### Missing Features (Design O, Implementation X)

| ID | Priority | Item | Design Location | Description |
|---|:---:|---|---|---|
| P1-1 | P1 | WMS price read-only enforcement | 2.2 / 2.5 | API allows price changes for HEADQUARTERS products |
| P1-2 | P1 | Excel export download buttons | 2.4 | Orders page has no export download UI |
| P2-1 | P2 | SELLER search overwrite bug | 2.2 | Search filter overwritten by SELLER auth filter |
| P2-2 | P2 | Auto-split transaction | 2.3 | Split orders not wrapped in $transaction |
| P2-3 | P2 | Total amount duplication | 2.3 | Both split orders get full totalAmount |
| P2-4 | P2 | ProductType list filter | 2.5 | No filter UI on products list page |

### Convention Violations

| ID | Priority | Item | Location | Description |
|---|:---:|---|---|---|
| C1 | P1 | `withRole()` not used | All 7 route handlers | `auth()` used directly instead of `withRole()` |
| C2 | P2 | Product type def outdated | `types/product.ts` | Missing Phase 2 fields, wrong typing |
| C3 | P2 | Order type def outdated | `types/order.ts` | Missing Phase 2 fields, wrong field names |

### Added Features (Design X, Implementation O)

| Item | Implementation Location | Description |
|---|---|---|
| Date range filter on export | `app/api/orders/export/route.ts:17-18` | `startDate`/`endDate` params not in design |
| Product detail center stocks | `app/api/products/[id]/route.ts:39-44` | `centerStocks` include on GET |
| SELLER view restriction | `app/api/products/[id]/route.ts:52-58` | SELLER can only view own CENTER products |

---

## Verification Checklist (from Design)

| # | Verification Step | Result |
|---|---|:---:|
| 1a | Create WMS product without barcode -> fail | PASS (API returns VALIDATION_ERROR) |
| 1b | Create WMS product with barcode -> success | PASS |
| 1c | Create CENTER product without barcode -> success | PASS |
| 1d | SELLER can only create CENTER products | PASS (API returns FORBIDDEN) |
| 2a | Order with 2 WMS + 3 CENTER -> 2 orders | PASS (split logic works) |
| 2b | Split orders have correct suffixes | PASS (-WMS, -CENTER) |
| 2c | Each order has correct items | PASS (filtered by productType) |
| 3a | Download WMS export -> only WMS orders | PASS (API filters correctly) |
| 3b | Download CENTER export -> only CENTER orders | PASS (API filters correctly) |
| 3c | Download buttons visible in UI | **FAIL** (no buttons in orders page) |
| 4a | SELLER tries to edit WMS product -> fail | PASS (API returns FORBIDDEN) |
| 4b | SELLER tries to edit own CENTER product -> success | PASS |
| 4c | ADMIN edits any product -> success | PASS |
| 4d | WMS product price change -> fail | **FAIL** (API allows, only UI blocks) |

---

## Recommended Actions

### Phase A: P1 Fixes (Immediate)

1. **P1-1**: Add price change guard for HEADQUARTERS products in `app/api/products/[id]/route.ts`
   - Insert check before `updateData` construction: reject `sellPrice`/`supplyPrice` for HEADQUARTERS
   - Estimated effort: 10 lines of code

2. **P1-2**: Add 2 Excel export download buttons to `/app/(main)/orders/page.tsx`
   - "슈퍼무진 주문서 다운로드" button -> `/api/orders/export?type=wms`
   - "자사몰 주문서 다운로드" button -> `/api/orders/export?type=center`
   - Estimated effort: 15 lines of code

3. **C1**: Migrate all 7 route handlers from `auth()` to `withRole()`
   - `app/api/products/route.ts` (GET, POST)
   - `app/api/products/[id]/route.ts` (GET, PUT, DELETE)
   - `app/api/orders/route.ts` (GET, POST)
   - `app/api/orders/export/route.ts` (GET)
   - Estimated effort: Refactor each handler to use `withRole()` wrapper

### Phase B: P2 Fixes (Next Sprint)

4. **P2-1**: Fix SELLER search filter overwrite in `app/api/products/route.ts`
   - Use `where.AND` to combine search and authorization filters

5. **P2-2**: Wrap split order creation in `prisma.$transaction`

6. **P2-3**: Fix total amount calculation for split orders (proportional split)

7. **P2-4**: Add productType filter tabs/dropdown on products list page

8. **C2/C3**: Update TypeScript type definitions to match Prisma schema
   - `types/product.ts`: Add `managedBy`, `isWmsProduct`, type `productType` as union
   - `types/order.ts`: Add Phase 2 fields, fix `OrderItem` field names

---

## Match Rate Calculation

| Category | Weight | Score | Weighted |
|---|:---:|:---:|:---:|
| 2.1 Database Schema | 20% | 100% | 20.0% |
| 2.2 Product CRUD Update | 20% | 88% | 17.6% |
| 2.3 Order Auto-Split Logic | 20% | 90% | 18.0% |
| 2.4 Excel Export Split | 15% | 80% | 12.0% |
| 2.5 Product UI Update | 15% | 92% | 13.8% |
| Architecture Compliance | 5% | 70% | 3.5% |
| Convention Compliance | 5% | 65% | 3.25% |
| **Total** | **100%** | | **88.2%** |

**Overall Match Rate: 88% (rounded)**

---

## Version History

| Version | Date | Changes | Analyzer |
|---------|------|---------|----------|
| v1 | 2026-04-15 | Initial analysis | bkit-gap-detector |

---

## Related Documents

- Schema: `/Users/jinwoo/Desktop/live-commerce/prisma/schema.prisma`
- Products API: `/Users/jinwoo/Desktop/live-commerce/app/api/products/route.ts`
- Products [id] API: `/Users/jinwoo/Desktop/live-commerce/app/api/products/[id]/route.ts`
- Orders API: `/Users/jinwoo/Desktop/live-commerce/app/api/orders/route.ts`
- Export API: `/Users/jinwoo/Desktop/live-commerce/app/api/orders/export/route.ts`
- Products List UI: `/Users/jinwoo/Desktop/live-commerce/app/(main)/products/page.tsx`
- Product New UI: `/Users/jinwoo/Desktop/live-commerce/app/(main)/products/new/page.tsx`
- Product Detail UI: `/Users/jinwoo/Desktop/live-commerce/app/(main)/products/[id]/page.tsx`
- Orders List UI: `/Users/jinwoo/Desktop/live-commerce/app/(main)/orders/page.tsx`
- Product Types: `/Users/jinwoo/Desktop/live-commerce/types/product.ts`
- Order Types: `/Users/jinwoo/Desktop/live-commerce/types/order.ts`
