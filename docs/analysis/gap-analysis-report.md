# Design-Implementation Gap Analysis Report

> **Summary**: Google Apps Script v3.4 (71 functions, 1,444 LOC) vs Next.js Implementation Gap Analysis
>
> **Author**: Claude Code (gap-detector)
> **Created**: 2026-04-06
> **Last Modified**: 2026-04-06
> **Status**: Draft

---

## 1. Analysis Overview

| Item | Value |
|------|-------|
| Analysis Target | Live Commerce Management System Migration |
| Source System | Google Apps Script v3.4 (docs/appscript/original-code.gs) |
| Target System | Next.js 16 + React 19 + Neon PostgreSQL |
| Plan Document | docs/01-plan/features/live-commerce-migration.plan.md |
| Analysis Date | 2026-04-06 |
| Total Original Functions | 71 |
| Original LOC | 1,444 |

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Database Schema Match | 80% | Warning |
| API Endpoint Coverage | 35% | Critical |
| UI Feature Coverage | 25% | Critical |
| Business Logic Coverage | 20% | Critical |
| Auth System | 55% | Warning |
| **Overall** | **32%** | Critical |

---

## 3. Feature-by-Feature Implementation Completeness

### 3.1 Authentication & User Management (13 GAS functions)

**Implementation Completeness: 40%**

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `doLogin(id, pw)` | `lib/auth.ts` (NextAuth Credentials) | Implemented | Email-based instead of ID-based login |
| `doRegister(d)` | -- | Missing | No signup page or API route |
| `getMemberData()` | `GET /api/users` (CRUD list) | Implemented | Basic list only, no cache |
| `getMemberMap()` | -- | Missing | No member map utility |
| `invalidateMemberCache()` | -- | N/A | Cache strategy different (no equivalent needed) |
| `getMySellers(adminNameOrId)` | -- | Missing | No admin-seller relationship query |
| `getSellersByAdmin(adminName)` | -- | Missing | No filtered seller list by admin |
| `getAllSellers()` | `GET /api/users?role=SELLER` (via search) | Partial | Can filter by search, but no role filter param |
| `updateSellerProfile(userId, channels, avgSales)` | `PUT /api/users/:id` | Partial | channels/avgSales not in DB schema |
| `getSellerProfileAndStats(sellerName)` | -- | Missing | No combined profile + order stats |
| `getAdminList()` | -- | Missing | No admin-specific list endpoint |
| `setupMemberDropdown()` | -- | N/A | GAS-specific UI helper |
| `fixAdminNames()` | -- | N/A | Data cleanup utility |

**Missing UI Pages:**
- Login page (`/login`) -- referenced in auth config but no file exists
- Signup page (`/signup`)
- User management page (`/(main)/users`)
- Password setup page (`/setup-password`)

**Missing API Routes:**
- `POST /api/auth/signup` -- user registration
- `POST /api/auth/setup-password` -- initial password setup
- `GET /api/users/me` -- current user info
- `GET /api/users?role=SELLER` -- role-based filtering (need custom filter)
- `GET /api/users/:id/sellers` -- sellers by admin

---

### 3.2 Order Management (14 GAS functions)

**Implementation Completeness: 25%**

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `submitBulkOrder(data)` | `POST /api/orders` | Partial | Basic create only, no Excel parsing, no multi-row bulk insert |
| `getRecentOrderBatches(role, userName)` | `GET /api/orders` | Partial | No role-based filtering, no batch grouping |
| `getOrdersByDate(date)` | -- | Missing | No date filter on orders |
| `updateSingleOrderStatus(row, field, value)` | `PUT /api/orders/:id` | Partial | Can update but no status-specific logic |
| `updateOrderStatus(orderId, statusType, value)` | `PUT /api/orders/:id` | Partial | No payment/shipping status |
| `bulkUpdateOrderStatus(date, field, value)` | -- | Missing | No bulk status update |
| `getSellerOrderHistory(sellerName)` | -- | Missing | No seller-specific order history |
| `deleteOrderBatch(date, seller)` | -- | Missing | No batch delete |
| `resetOrderHistory()` | -- | Missing | No order reset |
| `initOrderHeaders(ws)` | -- | N/A | GAS-specific sheet init |
| `resetAndInitOrders()` | -- | N/A | GAS-specific sheet init |
| `getOrderDataFast()` | -- | N/A | GAS cache layer (Prisma replaces) |
| `invalidateOrderCache()` | -- | N/A | GAS cache layer |
| `getShipColor(st)` | Status badges in page.tsx | Implemented | Badge colors for PENDING/APPROVED/REJECTED |

**Critical Missing Features:**
- Excel file upload + parsing (`POST /api/orders/upload`)
- Excel template download (`GET /api/orders/template`)
- Order approval workflow (`PUT /api/orders/:id/approve`)
- Order rejection workflow (`PUT /api/orders/:id/reject`)
- Payment status tracking (입금상태: 입금확인전/입금완료)
- Shipping status tracking (출고상태: 대기/발송준비/출고완료/부분출고)
- OrderItem relationship handling (orders with items)
- Role-based order filtering (seller sees own, admin sees team)

**Missing UI Pages:**
- `/orders/upload` -- Excel upload page (linked from orders page but does not exist)
- `/orders/new` -- New order form (linked from orders page but does not exist)
- Order detail view with approval/rejection actions

**Database Schema Gap:**
- Missing: `paymentStatus` field (입금상태) on Order model
- Missing: `shippingStatus` field (출고상태) on Order model
- These are core business statuses in the original system separate from OrderStatus

---

### 3.3 Barcode & Product Management (4 GAS functions)

**Implementation Completeness: 60%**

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `getProductList()` | `GET /api/products` | Implemented | CRUD list with search |
| `findByBarcode(bc)` | `GET /api/products?search={barcode}` | Partial | Uses generic search, not barcode-specific endpoint |
| `findByCode(c)` | `GET /api/products?search={code}` | Partial | Uses generic search |
| `normBarcode(v)` | -- | Missing | No barcode normalization utility |

**Missing Features:**
- Dedicated barcode search endpoint (`GET /api/products/search?barcode=...`)
- Barcode normalization (BigInt handling, whitespace stripping)
- Low stock alert (`GET /api/products?stock=low`)
- Recent search history (localStorage)
- Mobile camera scan support

**UI Status:**
- Barcode page exists with basic search functionality
- Product info display with stock breakdown (working)
- Missing: StockIndicator badge component
- Missing: Low stock warning indicator

---

### 3.4 Broadcast Management (9 GAS functions)

**Implementation Completeness: 30%**

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `startBroadcast(data)` | -- | Missing | No start broadcast action |
| `endBroadcast(bcCode)` | -- | Missing | No end broadcast action |
| `getRecentBroadcasts(sellerName)` | `GET /api/broadcasts` | Partial | Basic list, no seller filter |
| `addBroadcastSchedule(...)` | `POST /api/broadcasts` | Partial | Basic create, no date/place/time separation |
| `getMonthSchedules(ym, role, name)` | -- | Missing | No monthly schedule query |
| `confirmBroadcastSchedule(row)` | -- | Missing | No confirm action |
| `cancelBroadcastSchedule(row)` | -- | Missing | No cancel action |
| `changeBroadcastSchedule(row, nd, nt)` | `PUT /api/broadcasts/:id` | Partial | Generic update |
| `changeBroadcastDate(row, nd)` | `PUT /api/broadcasts/:id` | Partial | Generic update |

**Critical Missing Features:**
- `PUT /api/broadcasts/:id/start` -- start broadcast
- `PUT /api/broadcasts/:id/end` -- end broadcast
- `GET /api/broadcasts?month=YYYY-MM` -- monthly schedule
- `GET /api/broadcasts/stats` -- platform statistics
- Calendar view (react-big-calendar)
- Broadcast form (new broadcast registration page)
- Role-based filtering (seller/admin/master)

**UI Status:**
- List view with DataTable exists
- Start/End buttons are rendered but have no click handlers
- `/broadcasts/new` is linked but page does not exist
- No calendar view

---

### 3.5 Statistics & Dashboard (7 GAS functions)

**Implementation Completeness: 5%**

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `getPerformanceData(role, name, fromDate, toDate)` | -- | Missing | No performance data endpoint |
| `getAdminDashboard()` | -- | Missing | No admin dashboard |
| `getAdminDetail(adminName)` | -- | Missing | No admin detail view |
| `getMySellersDashboard(adminName)` | -- | Missing | No seller management dashboard |
| `getSellerAnalytics(role, name)` | -- | Missing | No seller analytics |
| `getSellerStats(sn)` | -- | Missing | No seller stats |
| `debugAdminMapping()` | -- | N/A | Debug utility |

**Critical Missing Features:**
- `GET /api/sales/stats?period=month` -- sales statistics
- `GET /api/sales/ranking?type=seller` -- seller ranking
- `GET /api/sales?from=...&to=...` -- date-range filtering
- Dashboard page (`/(main)/dashboard`)
- Sales chart components (Recharts -- LineChart, PieChart)
- KPI cards (total revenue, order count, average price)
- Seller ranking table
- Date range filter

**UI Status:**
- Sales page has 3 static placeholder cards (all showing 0)
- No actual data aggregation
- No chart components
- No dashboard page exists at all

---

### 3.6 AI & Market Analysis (5 GAS functions)

**Implementation Completeness: 0%** (Deferred to Phase 2 per plan)

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `getAISalesPoints(...)` | -- | Deferred | Phase 2 scope |
| `callOpenAI(prompt)` | -- | Deferred | Phase 2 scope |
| `callGemini(prompt)` | -- | Deferred | Phase 2 scope |
| `buildLocalAnalysis(...)` | -- | Deferred | Phase 2 scope |
| `searchNaverShopping(query)` | -- | Deferred | Phase 2 scope |

These functions are explicitly out of scope per the migration plan (Section 1.3 Out of Scope).

---

### 3.7 Proposals (2 GAS functions)

**Implementation Completeness: 0%**

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `submitProposal(data)` | -- | Missing | No proposal model/API |
| `getProposals()` | -- | Missing | No proposal list |

**Note:** Proposal functionality is not mentioned in the plan document. Decision needed: migrate or deprecate.

---

### 3.8 Utility & Infrastructure

**Implementation Completeness: 70%**

| GAS Utility | Next.js Equivalent | Status |
|---|---|:---:|
| Cache layer (cacheSet/Get/Delete) | DB-based RateLimit + Prisma query cache | Different approach |
| Header map builder | Prisma ORM (type-safe) | N/A |
| Number/String/Date helpers | TypeScript native | N/A |
| Role resolution | Role enum in Prisma schema | Implemented |
| Spreadsheet access | Prisma DB client | Implemented |

---

## 4. Database Schema Gap Analysis

### 4.1 User Model

| Field | Plan | Schema | Status |
|---|---|---|:---:|
| id | cuid() | cuid() | Match |
| email | String unique | String unique | Match |
| name | String | String | Match |
| phone | String? | String? | Match |
| role | Role enum | Role enum | Match |
| adminId | String? (self-ref) | String? (self-ref) | Match |
| passwordHash | String? | String? | Match |
| **channels** | **String[]** | **-- MISSING --** | Gap |
| **avgSales** | **Int?** | **-- MISSING --** | Gap |
| createdAt | DateTime | DateTime | Match |
| updatedAt | DateTime | DateTime | Match |

**Impact:** The `types/user.ts` TypeScript interface includes `channels: string[]` and `avgSales: number | null`, but the Prisma schema does not have these fields. This means:
1. API writes to these fields will silently fail
2. Runtime type mismatch between frontend expectations and actual DB data

### 4.2 Order Model

| Field | Plan | Schema | Status |
|---|---|---|:---:|
| id - updatedAt | (standard) | (standard) | Match |
| **adminId relation** | **admin User? relation** | **-- No relation --** | Gap |
| **paymentStatus** | **N/A (GAS: 입금상태)** | **-- MISSING --** | Gap |
| **shippingStatus** | **N/A (GAS: 출고상태)** | **-- MISSING --** | Gap |

**Impact:** The original system tracks payment status (입금확인전/입금완료) and shipping status (대기/발송준비/출고완료/부분출고) independently. These are missing from the Prisma schema.

### 4.3 Proposal Model

| Status | Description |
|--------|-------------|
| Missing Entirely | GAS has a PROPOSALS sheet with: date, company, manager, phone, email, productName, category, description, fileUrl, AI analysis, score, status |

### 4.4 Existing Schema Assessment

All 6 core models (User, Product, Order, OrderItem, Broadcast, Sale) + RateLimit exist with correct basic structure. Relationships are properly defined. Indexes are needed for common query patterns.

---

## 5. Missing API Endpoints Summary

### Plan-Specified Endpoints Not Implemented

| Endpoint | Plan Reference | Priority |
|---|---|:---:|
| `POST /api/auth/signup` | FR-01 | P0 |
| `POST /api/auth/setup-password` | FR-01 | P0 |
| `GET /api/users/me` | FR-01 | P0 |
| `GET /api/products/search?barcode={barcode}` | FR-02 | P0 |
| `GET /api/products?stock=low` | FR-02 | P1 |
| `POST /api/orders/upload` | FR-03 | P0 |
| `GET /api/orders/template` | FR-03 | P0 |
| `PUT /api/orders/:id/approve` | FR-03 | P0 |
| `PUT /api/orders/:id/reject` | FR-03 | P0 |
| `PUT /api/broadcasts/:id/start` | FR-04 | P1 |
| `PUT /api/broadcasts/:id/end` | FR-04 | P1 |
| `GET /api/broadcasts?month=YYYY-MM` | FR-04 | P1 |
| `GET /api/broadcasts/stats` | FR-04 | P2 |
| `GET /api/sales?from=...&to=...` | FR-05 | P1 |
| `GET /api/sales/stats?period=month` | FR-05 | P1 |
| `GET /api/sales/ranking?type=seller` | FR-05 | P2 |

### GAS-Equivalent Endpoints Not Covered

| GAS Function | Suggested Endpoint | Priority |
|---|---|:---:|
| `bulkUpdateOrderStatus` | `PATCH /api/orders/bulk-status` | P1 |
| `getSellerOrderHistory` | `GET /api/orders?sellerId=...` (filter) | P1 |
| `getAdminDashboard` | `GET /api/dashboard/admin` | P1 |
| `getPerformanceData` | `GET /api/dashboard/performance` | P1 |
| `getSellerAnalytics` | `GET /api/dashboard/sellers` | P2 |

---

## 6. Missing UI Features Summary

| Page | Status | Missing Elements |
|---|:---:|---|
| `/login` | Missing | Login form, error handling, redirect |
| `/signup` | Missing | Registration form, admin selection, terms |
| `/(main)/dashboard` | Missing | KPI cards, charts, quick actions |
| `/(main)/users` | Missing | User list, role management, seller assignment |
| `/(main)/orders/upload` | Missing | Excel upload, preview, validation |
| `/(main)/orders/new` | Missing | Manual order creation form |
| `/(main)/orders/[id]` | Missing | Order detail with approval/reject actions |
| `/(main)/broadcasts/new` | Missing | Broadcast registration form |
| `/(main)/broadcasts/calendar` | Missing | Monthly calendar view |
| `/(main)/sales/dashboard` | Missing | Charts (LineChart, PieChart), ranking |
| Root layout navigation | Missing | Sidebar navigation between pages |
| `/(main)/layout.tsx` | Missing | Shared layout with nav, auth guard |

---

## 7. Priority Action Items

### P0 -- Critical (Must Have for MVP)

| # | Task | Effort | Category |
|---|---|---|---|
| 1 | Create login page (`/login`) with NextAuth form | 2h | Auth UI |
| 2 | Create signup page + `POST /api/auth/signup` API | 3h | Auth |
| 3 | Create `/(main)/layout.tsx` with sidebar navigation | 2h | Layout |
| 4 | Add `paymentStatus` / `shippingStatus` to Order schema | 1h | Schema |
| 5 | Add `channels` / `avgSales` to User schema | 0.5h | Schema |
| 6 | Implement Excel upload endpoint (`POST /api/orders/upload`) | 4h | Order API |
| 7 | Create order upload page with preview | 3h | Order UI |
| 8 | Implement order approval/rejection APIs | 2h | Order API |
| 9 | Add barcode-specific search endpoint | 1h | Product API |
| 10 | Add role-based data filtering to CRUD handlers | 3h | Middleware |
| 11 | Implement `GET /api/users/me` endpoint | 0.5h | Auth API |
| 12 | Create dashboard page with basic KPI | 3h | Dashboard |

**Estimated P0 Total: ~25 hours**

### P1 -- High Priority (Required for Parity)

| # | Task | Effort | Category |
|---|---|---|---|
| 13 | Broadcast start/end action APIs | 2h | Broadcast API |
| 14 | Monthly broadcast schedule query | 1h | Broadcast API |
| 15 | Broadcast calendar view (react-big-calendar) | 4h | Broadcast UI |
| 16 | Broadcast registration form page | 2h | Broadcast UI |
| 17 | Sales statistics endpoint | 3h | Sales API |
| 18 | Sales date-range filtering | 1h | Sales API |
| 19 | Sales dashboard with Recharts charts | 4h | Sales UI |
| 20 | Bulk order status update API | 2h | Order API |
| 21 | Order detail page with items | 2h | Order UI |
| 22 | User management page | 3h | User UI |
| 23 | Admin dashboard API | 3h | Dashboard API |
| 24 | Seller analytics API | 2h | Dashboard API |
| 25 | Excel template download API | 1h | Order API |
| 26 | Password setup flow | 2h | Auth |

**Estimated P1 Total: ~32 hours**

### P2 -- Nice to Have (Enhancement)

| # | Task | Effort | Category |
|---|---|---|---|
| 27 | Seller ranking API and UI | 2h | Sales |
| 28 | Platform-specific broadcast statistics | 2h | Broadcast |
| 29 | Recent barcode search history (localStorage) | 1h | Barcode UI |
| 30 | Mobile camera barcode scan | 4h | Barcode |
| 31 | Low stock alert notification | 1h | Product |
| 32 | Admin-seller mapping dashboard | 3h | Dashboard |
| 33 | Data export (CSV download) | 2h | Utility |
| 34 | Proposal submission system (if needed) | 4h | New Feature |
| 35 | Performance optimization (query caching) | 2h | Infrastructure |

**Estimated P2 Total: ~21 hours**

---

## 8. Detailed Gap Comparison by Category

### 8.1 Missing Features (Design/GAS Has, Implementation Does Not)

| # | Item | Source Location | Description | Impact |
|---|---|---|---|---|
| 1 | User Registration | GAS:doRegister | No signup flow exists | High |
| 2 | Login UI | Plan:FR-01 | Auth config references `/login` but page missing | High |
| 3 | Excel Upload | GAS:submitBulkOrder | Core order workflow missing | High |
| 4 | Order Approval | GAS:updateOrderStatus | No approval/rejection actions | High |
| 5 | Payment Status | GAS:입금상태 | Not tracked in schema | High |
| 6 | Shipping Status | GAS:출고상태 | Not tracked in schema | High |
| 7 | Dashboard | Plan:FR-05 | No dashboard page | High |
| 8 | Broadcast Calendar | Plan:FR-04 | Calendar view missing | Medium |
| 9 | Sales Charts | Plan:FR-05 | No Recharts integration | Medium |
| 10 | Role-based Filtering | GAS:all queries | Users see all data regardless of role | High |

### 8.2 Added Features (Implementation Has, Not in Original GAS)

| # | Item | Implementation Location | Description |
|---|---|---|---|
| 1 | Rate Limiting (DB-based) | `lib/api/rate-limit-db.ts` | Write rate limit per user/model |
| 2 | CSRF Protection | `lib/api/middleware.ts` | Origin-based CSRF verification |
| 3 | Structured Logging | `lib/logger.ts` | Security and application logging |
| 4 | Generic CRUD Factory | `lib/api/create-crud-handler-prisma.ts` | Reusable CRUD with auth/validation |
| 5 | Zod Schema Validation | All API routes | Request body validation |
| 6 | DataTable Components | `components/ui/data-table/*` | Reusable table with sort/search/pagination |

### 8.3 Changed Features (Design != Implementation)

| Item | GAS/Plan | Implementation | Impact |
|---|---|---|---|
| Login method | ID + password | Email + password | Low (improvement) |
| Role names | Korean (마스터/셀러) | English enum (MASTER/SELLER) | Low (standardized) |
| Data storage | Google Sheets | PostgreSQL | Low (expected migration) |
| Cache strategy | GAS CacheService (300s) | DB RateLimit + Prisma | Low (different arch) |
| Order status | 입금상태 + 출고상태 (2 fields) | Single status enum (PENDING/APPROVED/REJECTED) | **High (data loss)** |
| Broadcast model | Schedule sheet (date/time/place/seller) | Single model with scheduledAt | Medium |

---

## 9. Recommendations

### 9.1 Immediate Actions (This Sprint)

1. **Schema Migration** -- Add `paymentStatus`, `shippingStatus` to Order model; add `channels`, `avgSales` to User model. Run `prisma migrate dev`.

2. **Auth Pages** -- Create `/login` and `/signup` pages. The auth backend exists but has no frontend.

3. **Navigation Layout** -- Create `app/(main)/layout.tsx` with sidebar navigation. Currently pages are disconnected.

4. **Role-Based Filtering** -- The CRUD handler returns all records to all users. Need to add `where` conditions based on user role (seller sees own, admin sees team).

5. **Order Workflow** -- The order system is the most critical business feature. Excel upload + approval/rejection must be implemented before launch.

### 9.2 Documentation Updates Needed

1. Plan document should note that `channels` and `avgSales` are in the plan schema but missing from actual Prisma schema.
2. The `types/user.ts` includes fields not in the database -- this is a type-safety risk.
3. Order status model in plan (3 states) differs from GAS (2 independent status fields). Decision needed on which approach to follow.

### 9.3 Architecture Recommendations

1. **Custom API Routes** -- The CRUD factory covers basic CRUD but business-specific endpoints (upload, approve, stats) need custom route handlers.

2. **Service Layer** -- Business logic like Excel parsing, status transitions, and statistics aggregation should live in a `services/` or `lib/services/` directory, not directly in route handlers.

3. **Middleware Enhancement** -- Add Next.js root `middleware.ts` for route protection (redirect unauthenticated users from `/(main)/*` to `/login`).

---

## 10. Summary

The Next.js project has a solid **infrastructure foundation**:
- Prisma schema with 6 core models
- CRUD API factory with auth, validation, rate limiting
- DataTable component system
- NextAuth authentication backend

However, **business logic implementation is at ~32%**. The project is essentially in a "scaffolding complete, features pending" state. The most critical gaps are:

1. **No auth UI** (login/signup pages)
2. **No Excel upload** (core business workflow)
3. **No order approval workflow**
4. **No dashboard/statistics**
5. **No role-based data scoping**
6. **Schema gaps** (payment/shipping status, user channels)

The estimated effort to reach functional parity with the GAS system (excluding AI features) is approximately **57 hours** (P0: 25h + P1: 32h).

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-04-06 | Initial gap analysis | Claude Code |

## Related Documents
- Plan: [live-commerce-migration.plan.md](../01-plan/features/live-commerce-migration.plan.md)
- GAS Functions: [appscript-functions.md](./appscript-functions.md)
- Original Code: [original-code.gs](../appscript/original-code.gs)
