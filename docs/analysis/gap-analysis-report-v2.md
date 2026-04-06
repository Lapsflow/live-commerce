# Design-Implementation Gap Analysis Report v2

> **Summary**: Google Apps Script v3.4 (71 functions, 1,444 LOC) vs Next.js Implementation -- Updated Full Comparison
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
| Source System | Google Apps Script v3.4 (`docs/appscript/original-code.gs`) |
| Target System | Next.js 16 + React 19 + Neon PostgreSQL |
| Analysis Date | 2026-04-06 |
| Total Original Functions | 71 |
| Original LOC | 1,444 |
| Next.js API Routes | 14 (6 CRUD pairs + 2 custom endpoints + signup + dashboard) |
| Next.js Pages | 8 (login, signup, dashboard, orders, broadcasts, barcode, sales, home) |

---

## 2. Overall Scores

| Category | Score | Status | Change from v1 |
|----------|:-----:|:------:|:---:|
| Database Schema Match | 90% | Warning | +10% |
| API Endpoint Coverage | 50% | Warning | +15% |
| UI Feature Coverage | 45% | Warning | +20% |
| Business Logic Coverage | 35% | Critical | +15% |
| Auth System | 80% | Warning | +25% |
| Statistics/Dashboard | 50% | Warning | +45% |
| **Overall Match Rate** | **~48%** | **Critical** | **+16%** |

### Score Criteria
- 90%+: Fully implemented
- 70-89%: Warning -- minor gaps
- Below 70%: Critical -- significant gaps

---

## 3. Feature-by-Feature Comparison

### 3.1 Authentication & User Management (13 GAS functions)

**Implementation Completeness: 55%** (up from 40%)

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `doLogin(id, pw)` | `app/(auth)/login/page.tsx` + `lib/auth.ts` | Implemented | Full login UI + NextAuth Credentials provider |
| `doRegister(d)` | `app/(auth)/signup/page.tsx` + `app/api/auth/signup/route.ts` | Implemented | Full signup form with role selection + admin dropdown |
| `getMemberData()` | `GET /api/users` (CRUD list) | Implemented | Paginated list with search |
| `getMemberMap()` | -- | Missing | No member map utility (needed for admin-seller mapping) |
| `invalidateMemberCache()` | -- | N/A | Different cache strategy (Prisma) |
| `getMySellers(adminNameOrId)` | -- | Missing | No admin-to-seller query endpoint |
| `getSellersByAdmin(adminName)` | `lib/api/role-filter.ts` (partial) | Partial | Role filter exists for queries but no dedicated API |
| `getAllSellers()` | `GET /api/users` (with search) | Partial | Can search but no role= filter parameter |
| `updateSellerProfile(userId, channels, avgSales)` | `PUT /api/users/:id` | Partial | channels/avgSales NOT in Prisma schema (type mismatch) |
| `getSellerProfileAndStats(sellerName)` | -- | Missing | No combined profile + order stats |
| `getAdminList()` | `GET /api/users` (in signup page) | Partial | Signup page fetches admin list via /api/users?role=ADMIN |
| `setupMemberDropdown()` | -- | N/A | GAS-specific UI helper |
| `fixAdminNames()` | -- | N/A | Data cleanup utility |

**What Works Well:**
- Login page (`/login`) with NextAuth credentials, error handling, redirect to dashboard
- Signup page (`/signup`) with role selection (SELLER/ADMIN), admin dropdown, bcrypt hashing
- Signup API (`POST /api/auth/signup`) with Zod validation, duplicate checking
- User CRUD via `createCrudHandler` with passwordHash excluded from responses

**Still Missing:**
- `GET /api/users/me` -- current user info endpoint
- `GET /api/users?role=SELLER` -- role-based filtering parameter
- `GET /api/users/:id/sellers` -- sellers by admin endpoint
- GAS "approval pending" registration flow (GAS sets status to "approval pending", admin approves)
- Seller profile page with channels/avgSales editing
- User management admin page

**Schema Gap:**
- `types/user.ts` declares `channels: string[]` and `avgSales: number | null`
- Prisma `schema.prisma` User model does NOT have these fields
- Runtime type mismatch risk

---

### 3.2 Order Management (14 GAS functions)

**Implementation Completeness: 40%** (up from 25%)

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `submitBulkOrder(data)` | `POST /api/orders` | Partial | Basic single-order create, no Excel bulk parsing |
| `getRecentOrderBatches(role, userName)` | `GET /api/orders` | Partial | Paginated list with role-based filtering via CRUD factory |
| `getOrdersByDate(date)` | -- | Missing | No date filter on orders API |
| `updateSingleOrderStatus(row, field, value)` | `PUT /api/orders/:id/status` | Implemented | Custom endpoint for paymentStatus + shippingStatus |
| `updateOrderStatus(orderId, statusType, value)` | `PUT /api/orders/:id/status` | Implemented | Supports both payment and shipping status |
| `bulkUpdateOrderStatus(date, field, value)` | -- | Missing | No bulk status update endpoint |
| `getSellerOrderHistory(sellerName)` | `GET /api/orders` (with role filter) | Partial | CRUD factory has role-based filter but no seller-specific endpoint |
| `deleteOrderBatch(date, seller)` | `DELETE /api/orders/:id` | Partial | Single delete only, no batch delete by date+seller |
| `resetOrderHistory()` | -- | Missing | No order reset function |
| `initOrderHeaders(ws)` | -- | N/A | GAS-specific |
| `resetAndInitOrders()` | -- | N/A | GAS-specific |
| `getOrderDataFast()` | Prisma queries | N/A | Prisma replaces cache layer |
| `invalidateOrderCache()` | -- | N/A | Different cache strategy |
| `getShipColor(st)` | Orders page status badges | Implemented | Full color mapping for payment, shipping, approval status |

**What Works Well:**
- Order CRUD (list, create, get, update, delete) via `createCrudHandler`
- Order status tracking with `paymentStatus` (UNPAID/PAID) and `shippingStatus` (PENDING/PREPARING/SHIPPED/PARTIAL) in Prisma schema
- Custom `PUT /api/orders/:id/status` endpoint for status updates
- Orders page (`/orders`) with DataTable showing orderNo, seller, paymentStatus, shippingStatus, approval status, totalAmount
- Status badges with correct color mapping (Korean labels: "paymentStatus": "입금확인전"/"입금완료", "shippingStatus": "대기"/"발송준비"/"출고완료"/"부분출고")
- Role-based data filtering (seller sees own, admin sees team, master sees all)
- Links to `/orders/upload` and `/orders/new` (UI buttons exist)

**Still Missing:**
- `POST /api/orders/upload` -- Excel upload parsing (critical business flow)
- `GET /api/orders/template` -- Excel template download
- `PUT /api/orders/:id/approve` -- approval workflow
- `PUT /api/orders/:id/reject` -- rejection workflow
- `PATCH /api/orders/bulk-status` -- bulk status update by date
- `/orders/upload` page -- linked from orders page but does not exist
- `/orders/new` page -- linked from orders page but does not exist
- `/orders/[id]` page -- order detail view with items
- Date-based order filtering
- Order batch grouping (GAS groups by date+seller)
- OrderItem management in create/display

**Schema Status:**
- Order model now includes `paymentStatus` (PaymentStatus enum) and `shippingStatus` (ShippingStatus enum) -- **resolved from v1**
- Composite index on `[paymentStatus, shippingStatus]` exists
- OrderItem model properly defined with relations

---

### 3.3 Barcode & Product Management (4 GAS functions)

**Implementation Completeness: 70%** (up from 60%)

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `getProductList()` | `GET /api/products` | Implemented | CRUD list with search on code, name, barcode |
| `findByBarcode(bc)` | `GET /api/products?search={barcode}` | Implemented | Generic search covers barcode field |
| `findByCode(c)` | `GET /api/products?search={code}` | Implemented | Generic search covers code field |
| `normBarcode(v)` | -- | Missing | No barcode normalization (BigInt, whitespace) |

**What Works Well:**
- Product CRUD (list, create, get, update, delete) with all fields
- Barcode page (`/barcode`) with search input, Enter key support
- Product info card showing: code, name, barcode, sellPrice, supplyPrice, marginRate, marginAmount, totalStock
- Stock breakdown display: stockMujin, stock1, stock2, stock3
- Margin calculation: `((sellPrice - supplyPrice) / sellPrice) * 100`
- Search uses `contains` + `insensitive` mode across code, name, barcode fields

**Still Missing:**
- Barcode normalization utility (BigInt handling for long barcodes like EAN-13)
- Dedicated barcode-specific search endpoint (exact match vs contains)
- Low stock alert/indicator
- Mobile camera scan support
- Recent search history

---

### 3.4 Broadcast Management (9 GAS functions)

**Implementation Completeness: 60%** (up from 30%)

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `startBroadcast(data)` | `PUT /api/broadcasts/:id/start` | Implemented | Status SCHEDULED->LIVE, records startedAt |
| `endBroadcast(bcCode)` | `PUT /api/broadcasts/:id/end` | Implemented | Status LIVE->ENDED, records endedAt |
| `getRecentBroadcasts(sellerName)` | `GET /api/broadcasts` | Implemented | Paginated list with role filter |
| `addBroadcastSchedule(...)` | `POST /api/broadcasts` | Implemented | Create with platform, scheduledAt, memo |
| `getMonthSchedules(ym, role, name)` | -- | Missing | No monthly schedule query |
| `confirmBroadcastSchedule(row)` | -- | Missing | No confirm action (status -> "confirmed") |
| `cancelBroadcastSchedule(row)` | `PUT /api/broadcasts/:id` (status=CANCELED) | Partial | Can update to CANCELED via generic update |
| `changeBroadcastSchedule(row, nd, nt)` | `PUT /api/broadcasts/:id` | Implemented | Generic update covers date/time change |
| `changeBroadcastDate(row, nd)` | `PUT /api/broadcasts/:id` | Implemented | Generic update covers date change |

**What Works Well:**
- Broadcast CRUD (list, create, get, update, delete) via `createCrudHandler`
- Custom `PUT /api/broadcasts/:id/start` with state validation:
  - Prevents starting LIVE, ENDED, or CANCELED broadcasts
  - Records `startedAt` timestamp
- Custom `PUT /api/broadcasts/:id/end` with state validation:
  - Only LIVE broadcasts can be ended
  - Records `endedAt` timestamp
- Broadcasts page (`/broadcasts`) with:
  - DataTable showing code, seller, platform (Korean labels), status (badges with pulse animation for LIVE)
  - Start/End action buttons per row with loading state
  - Toast notifications on success/error
  - Link to `/broadcasts/new`
- Platform enum: GRIP, CLME, YOUTUBE, TIKTOK, BAND, OTHER
- Status enum: SCHEDULED, LIVE, ENDED, CANCELED

**Still Missing:**
- `GET /api/broadcasts?month=YYYY-MM` -- monthly schedule filtering
- `GET /api/broadcasts/stats` -- platform statistics
- `/broadcasts/new` page -- registration form
- `/broadcasts/calendar` page -- calendar view (react-big-calendar)
- Schedule confirmation action (GAS "confirmed"/"requested" status distinction)
- Role-based schedule visibility per GAS logic

---

### 3.5 Statistics & Dashboard (7 GAS functions)

**Implementation Completeness: 50%** (up from 5%)

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `getPerformanceData(role, name, fromDate, toDate)` | `GET /api/stats/dashboard` (partial) | Partial | Total aggregates available, no date range filter |
| `getAdminDashboard()` | `GET /api/stats/dashboard` | Partial | Has total sales, count, ranking but not admin-specific |
| `getAdminDetail(adminName)` | -- | Missing | No admin detail view |
| `getMySellersDashboard(adminName)` | -- | Missing | No admin's sellers dashboard |
| `getSellerAnalytics(role, name)` | -- | Missing | No seller analytics with week-over-week comparison |
| `getSellerStats(sn)` | -- | Missing | No per-seller stats endpoint |
| `debugAdminMapping()` | -- | N/A | Debug utility |

**What Works Well:**
- Dashboard API (`GET /api/stats/dashboard`) providing:
  - Total sales amount (sum of totalPrice from Sale)
  - Total sale count
  - Average unit price
  - Total margin calculation (unitPrice - product.supplyPrice) * quantity
  - Daily sales trend (last 30 days) grouped by date
  - Top 10 seller ranking by totalSales
  - Role-based filtering via `getRoleBasedFilter()`
- Dashboard page (`/dashboard`) with:
  - 4 KPI StatCards: total sales, sale count, avg price, total margin (with trend indicators)
  - Line chart for daily sales trend (Recharts LineChart with Korean date format and wan-unit formatting)
  - Seller ranking table with trophy badges for top 3
  - Loading state and error handling
- Dashboard components:
  - `StatCard` -- reusable KPI card with trend arrows
  - `SalesChart` -- Recharts LineChart with responsive container
  - `RankingTable` -- trophy badges for ranks 1-3

**Still Missing:**
- Date range filtering (`?from=...&to=...`)
- Admin-specific dashboard (GAS: `getAdminDashboard` with admin-level aggregation)
- Admin detail view (sellers list with their sales stats)
- Seller analytics (week-over-week comparison, top products)
- Per-seller stats endpoint (orders, revenue, top products)
- "My Sellers" dashboard for admin role
- Upcoming broadcast schedule in dashboard

---

### 3.6 AI & Market Analysis (5 GAS functions)

**Implementation Completeness: 0%** (Deferred to Phase 2 per plan)

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `getAISalesPoints(barcode, name, sale, supply)` | -- | Deferred | Phase 2 scope |
| `callOpenAI(prompt)` | -- | Deferred | Phase 2 scope |
| `callGemini(prompt)` | -- | Deferred | Phase 2 scope |
| `buildLocalAnalysis(name, sale, supply)` | -- | Deferred | Phase 2 scope |
| `searchNaverShopping(query)` | -- | Deferred | Phase 2 scope |

These functions are explicitly out of scope per the migration plan. They provide:
- AI-generated sales talking points (headline, key benefits, target audience, price appeal)
- OpenAI (gpt-4o-mini) and Gemini (2.0-flash) API integration
- Fallback to local analysis when AI APIs fail
- Naver Shopping price comparison

---

### 3.7 Proposals (2 GAS functions)

**Implementation Completeness: 0%**

| GAS Function | Next.js Equivalent | Status | Notes |
|---|---|:---:|---|
| `submitProposal(data)` | -- | Missing | No Proposal model or API |
| `getProposals()` | -- | Missing | No proposal list |

GAS has a separate "proposal" page (accessed via `?page=proposal`) for companies to submit product proposals with fields: company, manager, phone, email, productName, category, description, fileUrl. Decision needed: migrate or deprecate.

---

### 3.8 Utility & Infrastructure

**Implementation Completeness: 80%** (up from 70%)

| GAS Utility | Next.js Equivalent | Status |
|---|---|:---:|
| Cache layer (`cacheSet/Get/Delete`) | DB-based RateLimit + SWR client cache | Different approach |
| Header map builder (`buildHeaderMap`) | Prisma ORM (type-safe) | N/A |
| Number/String/Date helpers (`hNum/hStr/hDate`) | TypeScript native | N/A |
| Role resolution (`_resolveRole`) | Role enum in Prisma schema | Implemented |
| Number formatter (`fmt`) | `toLocaleString()` in components | Implemented |
| Date formatter (`formatDateKorean`) | `toLocaleDateString("ko-KR")` | Implemented |
| Seller object builder (`_buildSellerObj`) | Prisma select with relations | Implemented |
| Spreadsheet access (`getSS`) | Prisma DB client | Implemented |
| Excel download (`downloadOrderTemplate/downloadOrderPad`) | -- | Missing |
| Bulk status change client code | -- | Missing |

---

## 4. Database Schema Gap Analysis

### 4.1 Schema Status Summary

| Model | Exists | Fields Complete | Notes |
|---|:---:|:---:|---|
| User | Yes | 90% | Missing `channels String[]`, `avgSales Int?` |
| Product | Yes | 100% | All GAS fields mapped |
| Order | Yes | 95% | paymentStatus + shippingStatus now present |
| OrderItem | Yes | 100% | Fully defined |
| Broadcast | Yes | 100% | Full platform/status enums |
| Sale | Yes | 100% | All fields mapped |
| RateLimit | Yes | 100% | New addition (not in GAS) |
| **Proposal** | **Missing** | **0%** | GAS has 12-field proposal sheet |

### 4.2 User Model Gap

```
Prisma schema (actual):
  id, email, name, phone, role, adminId, passwordHash, createdAt, updatedAt

types/user.ts (TypeScript):
  id, email, name, phone, role, adminId, admin, sellers, channels, avgSales, createdAt, updatedAt

Missing in Prisma: channels String[], avgSales Int?
```

**Impact:** `types/user.ts` declares `channels: string[]` and `avgSales: number | null` which do not exist in the database. Any frontend code relying on these fields will receive `undefined` values at runtime.

### 4.3 Order Model -- RESOLVED from v1

The Order model now correctly includes:
- `paymentStatus PaymentStatus @default(UNPAID)` -- enum: UNPAID, PAID
- `shippingStatus ShippingStatus @default(PENDING)` -- enum: PENDING, PREPARING, SHIPPED, PARTIAL
- Composite index: `@@index([paymentStatus, shippingStatus])`

This resolves the most critical schema gap from the v1 report.

---

## 5. Implemented Feature Inventory

### 5.1 API Routes (14 total)

| Route | Methods | Source |
|---|---|---|
| `/api/products` | GET, POST | CRUD factory |
| `/api/products/[id]` | GET, PUT, DELETE | CRUD factory |
| `/api/orders` | GET, POST | CRUD factory |
| `/api/orders/[id]` | GET, PUT, DELETE | CRUD factory |
| `/api/orders/[id]/status` | PUT | Custom handler |
| `/api/broadcasts` | GET, POST | CRUD factory |
| `/api/broadcasts/[id]` | GET, PUT, DELETE | CRUD factory |
| `/api/broadcasts/[id]/start` | PUT | Custom handler |
| `/api/broadcasts/[id]/end` | PUT | Custom handler |
| `/api/sales` | GET, POST | CRUD factory |
| `/api/sales/[id]` | GET, PUT, DELETE | CRUD factory |
| `/api/users` | GET, POST | CRUD factory |
| `/api/users/[id]` | GET, PUT, DELETE | CRUD factory |
| `/api/auth/signup` | POST | Custom handler |
| `/api/stats/dashboard` | GET | Custom handler |

### 5.2 UI Pages (8 total)

| Page | Route | Components Used |
|---|---|---|
| Home | `/` | Default Next.js template (needs replacement) |
| Login | `/login` | Card, Input, Button (NextAuth signIn) |
| Signup | `/signup` | Card, Input, Button, Select (role + admin dropdown) |
| Dashboard | `/dashboard` | StatCard, SalesChart, RankingTable |
| Orders | `/orders` | DataTable with status badges |
| Broadcasts | `/broadcasts` | DataTable with start/end actions |
| Barcode | `/barcode` | Search input + product info card |
| Sales | `/sales` | DataTable + 3 static summary cards |

### 5.3 Infrastructure

| Component | File | Function |
|---|---|---|
| Auth Provider | `lib/auth.ts` | NextAuth with Credentials + JWT |
| CRUD Factory | `lib/api/create-crud-handler-prisma.ts` | Generic CRUD with auth, validation, rate limit |
| Middleware | `lib/api/middleware.ts` | withAuth, withRole, CSRF verification |
| Role Filter | `lib/api/role-filter.ts` | getRoleBasedFilter for seller/admin/master |
| Response Helpers | `lib/api/response.ts` | ok, created, paginated, error, errors |
| Rate Limiting | `lib/api/rate-limit-db.ts` | DB-based rate limit per user/model |
| Logger | `lib/logger.ts` | Structured logging + security audit |
| Database | `lib/db/prisma.ts` | Prisma client singleton |
| DataTable | `components/ui/data-table/*` | 6 reusable table components |
| Dashboard | `components/dashboard/*` | StatCard, SalesChart, RankingTable |
| useApiCrud | `hooks/use-api-crud.ts` | SWR-based CRUD hook with toast |
| useDataTable | `hooks/use-data-table.ts` | Server-side DataTable hook |

---

## 6. Missing Features by Priority

### P0 -- Critical (Must Have for MVP)

| # | GAS Function(s) | Missing Feature | Effort | Impact |
|---|---|---|---|---|
| 1 | `submitBulkOrder` | Excel upload endpoint + parsing (`POST /api/orders/upload`) | 4h | Core business flow |
| 2 | `submitBulkOrder` | Excel upload page (`/orders/upload`) with preview/validation | 3h | Core business flow |
| 3 | -- | Excel template download (`GET /api/orders/template`) | 1h | User workflow |
| 4 | `updateOrderStatus` | Order approval workflow (`PUT /api/orders/:id/approve`) | 2h | Business logic |
| 5 | `updateOrderStatus` | Order rejection workflow (`PUT /api/orders/:id/reject`) | 1h | Business logic |
| 6 | -- | Main layout with sidebar navigation (`app/(main)/layout.tsx`) | 2h | Navigation |
| 7 | -- | Add `channels String[]` and `avgSales Int?` to User schema | 0.5h | Schema fix |
| 8 | -- | Home page redirect to `/dashboard` or `/login` | 0.5h | UX |
| 9 | `getMySellers` | Admin-to-seller relationship query API | 2h | Business logic |
| 10 | `getOrdersByDate` | Date-based order filtering | 1h | Business logic |

**Estimated P0 Total: ~17 hours**

### P1 -- High Priority (Required for Parity)

| # | GAS Function(s) | Missing Feature | Effort |
|---|---|---|---|
| 11 | `bulkUpdateOrderStatus` | Bulk order status update (`PATCH /api/orders/bulk-status`) | 2h |
| 12 | `getMonthSchedules` | Monthly broadcast schedule query + calendar view | 4h |
| 13 | `addBroadcastSchedule` | Broadcast registration form page (`/broadcasts/new`) | 2h |
| 14 | `getPerformanceData` | Date range filtering on stats dashboard | 2h |
| 15 | `getAdminDashboard` | Admin-specific dashboard API | 3h |
| 16 | `getSellerAnalytics` | Seller analytics (week-over-week, top products) | 3h |
| 17 | `getSellerStats` | Per-seller stats endpoint | 2h |
| 18 | `getSellerProfileAndStats` | Seller profile page with combined stats | 3h |
| 19 | -- | Order detail page (`/orders/[id]`) with items | 2h |
| 20 | -- | Order creation form (`/orders/new`) | 2h |
| 21 | -- | User management page (`/users`) | 3h |
| 22 | `doRegister` | Registration approval flow (admin approves new users) | 2h |
| 23 | -- | Next.js root middleware for route protection | 1h |
| 24 | `getSellerOrderHistory` | Seller order history view | 1h |
| 25 | `deleteOrderBatch` | Batch order delete by date+seller | 1h |

**Estimated P1 Total: ~33 hours**

### P2 -- Nice to Have (Enhancement)

| # | GAS Function(s) | Missing Feature | Effort |
|---|---|---|---|
| 26 | -- | Seller ranking standalone view | 2h |
| 27 | -- | Platform-specific broadcast statistics | 2h |
| 28 | `normBarcode` | Barcode normalization utility | 1h |
| 29 | -- | Recent barcode search history | 1h |
| 30 | -- | Mobile camera barcode scan | 4h |
| 31 | -- | Low stock alert/notification | 1h |
| 32 | `getMySellersDashboard` | Admin-seller mapping dashboard | 3h |
| 33 | -- | CSV/Excel data export | 2h |
| 34 | `submitProposal/getProposals` | Proposal submission system | 4h |
| 35 | -- | Performance optimization (query caching) | 2h |
| 36 | `confirmBroadcastSchedule` | Schedule confirmation status flow | 1h |
| 37 | `downloadOrderTemplate/Pad` | Client-side Excel download (XLSX.js) | 2h |
| 38 | `updateSellerProfile` | Seller profile editing UI | 2h |

**Estimated P2 Total: ~27 hours**

---

## 7. Differences Found

### 7.1 Missing Features (GAS Has, Implementation Does Not)

| # | Item | GAS Location | Description | Priority |
|---|---|---|---|:---:|
| 1 | Excel Upload | `submitBulkOrder` (L402) | Excel parsing with product lookup, barcode matching, margin calculation | P0 |
| 2 | Order Approval | `updateOrderStatus` (L573) | Approve/reject workflow with status transitions | P0 |
| 3 | Layout Navigation | buildJsPatch (L37) | GAS has sidebar with tabs; Next.js has no shared layout | P0 |
| 4 | User Schema Fields | GAS MEMBER sheet cols 8-9 | channels, avgSales fields not in Prisma schema | P0 |
| 5 | Bulk Status Update | `bulkUpdateOrderStatus` (L592) | Update all orders on a date at once | P1 |
| 6 | Monthly Schedule | `getMonthSchedules` (L1289) | Calendar view of broadcast schedules | P1 |
| 7 | Admin Dashboard | `getAdminDashboard` (L859) | Admin-specific aggregation with seller breakdown | P1 |
| 8 | Seller Analytics | `getSellerAnalytics` (L1062) | Week-over-week comparison, top products per seller | P1 |
| 9 | Seller Profile+Stats | `getSellerProfileAndStats` (L792) | Combined profile and sales stats view | P1 |
| 10 | Registration Approval | `doRegister` (L1119) | GAS sets status "approval pending"; admin approves | P1 |
| 11 | Order Batch Delete | `deleteOrderBatch` (L641) | Delete all orders by date+seller | P1 |
| 12 | Proposal System | `submitProposal/getProposals` (L1396) | Product proposal submission and listing | P2 |
| 13 | Excel Download | buildJsPatch (L48-80) | Template download and order pad download | P2 |
| 14 | Barcode Normalization | `normBarcode` (L1169) | BigInt handling for long barcodes | P2 |

### 7.2 Added Features (Implementation Has, Not in Original GAS)

| # | Item | Implementation Location | Description |
|---|---|---|---|
| 1 | DB Rate Limiting | `lib/api/rate-limit-db.ts` | Per-user write rate limit (30 ops/min) |
| 2 | CSRF Protection | `lib/api/middleware.ts` | Origin header verification for mutations |
| 3 | Structured Logging | `lib/logger.ts` | JSON logging with security audit events |
| 4 | Generic CRUD Factory | `lib/api/create-crud-handler-prisma.ts` | Reusable CRUD handler for all models |
| 5 | Zod Validation | All API routes | Type-safe request body validation |
| 6 | DataTable System | `components/ui/data-table/*` | Reusable table with sort, search, pagination, resize |
| 7 | SWR Data Fetching | `hooks/use-data-table.ts` | Client-side cache, dedup, stale-while-revalidate |
| 8 | Toast Notifications | `hooks/use-api-crud.ts` | Sonner toast on CRUD success/failure |
| 9 | Dev Auth Bypass | `lib/auth.ts` | DEV_AUTH_BYPASS for development (production blocked) |
| 10 | Sales Chart | `components/dashboard/sales-chart.tsx` | Recharts LineChart (GAS had no charts) |
| 11 | Seller Ranking Table | `components/dashboard/ranking-table.tsx` | Trophy badges for top sellers (GAS had plain list) |

### 7.3 Changed Features (GAS != Implementation)

| Item | GAS | Implementation | Impact |
|---|---|---|---|
| Login method | ID + password (plain text) | Email + bcrypt hash | Low (improvement) |
| Role names | Korean (마스터/셀러) | English enum (MASTER/SELLER) | Low (standardized) |
| Data storage | Google Sheets | PostgreSQL (Neon) | Low (expected) |
| Cache strategy | GAS CacheService (30-300s) | DB RateLimit + SWR client | Low (different arch) |
| Order status | 입금상태 + 출고상태 (Korean text) | PaymentStatus + ShippingStatus enums | Low (properly modeled now) |
| Registration flow | Sets "approval pending", admin approves | Immediate creation (no approval gate) | **Medium** |
| Broadcast schedule | Separate sheet with confirm/cancel status | Single model with status enum | Low (simplified) |
| Super account | Hardcoded super/mujin credentials | No super account | Low (security improvement) |
| Password storage | Plain text in sheet | bcrypt hashed | Low (security improvement) |

---

## 8. Function-by-Function Match Rate

### By Category

| Category | GAS Functions | Fully Implemented | Partially | Missing | N/A | Match Rate |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Auth & User (13) | 13 | 3 | 3 | 4 | 3 | 55% |
| Order (14) | 14 | 3 | 4 | 3 | 4 | 40% |
| Barcode/Product (4) | 4 | 2 | 2 | 0 | 0 | 70% |
| Broadcast (9) | 9 | 4 | 2 | 2 | 1 | 60% |
| Statistics (7) | 7 | 0 | 2 | 4 | 1 | 20% |
| AI/Market (5) | 5 | 0 | 0 | 0 | 5 | 0% (deferred) |
| Proposals (2) | 2 | 0 | 0 | 2 | 0 | 0% |
| Utility (10) | 10 | 3 | 0 | 2 | 5 | 55% |
| Web Entry (2) | 2 | 0 | 0 | 0 | 2 | N/A |

### Overall (excluding AI deferred + N/A)

- **Total scoreable functions**: 47 (71 - 5 AI deferred - 19 N/A/GAS-specific)
- **Fully implemented**: 15
- **Partially implemented**: 13
- **Missing**: 17
- **Weighted score**: (15 * 100% + 13 * 50% + 17 * 0%) / 47 = **45.7%**

---

## 9. Recommendations

### 9.1 Immediate Actions (Next Sprint)

1. **Main Layout** -- Create `app/(main)/layout.tsx` with sidebar navigation. Pages are disconnected without navigation.

2. **Schema Migration** -- Add `channels String[]` and `avgSales Int?` to User model. Run `prisma migrate dev`. Fix the type-safety gap with `types/user.ts`.

3. **Home Page** -- Replace the default Next.js template (`app/page.tsx`) with redirect to `/dashboard` (authenticated) or `/login` (not authenticated).

4. **Excel Upload** -- This is the single most critical missing business feature. Implement `POST /api/orders/upload` with XLSX parsing, product barcode lookup, margin calculation, and bulk order creation.

5. **Order Approval** -- Implement `PUT /api/orders/:id/approve` and `/reject` endpoints. Add approval actions to the orders page.

### 9.2 Architecture Recommendations

1. **Service Layer** -- Extract business logic (Excel parsing, status transitions, statistics aggregation) into `lib/services/` rather than placing it directly in route handlers.

2. **Root Middleware** -- Add `middleware.ts` at project root to redirect unauthenticated users from `/(main)/*` routes to `/login`.

3. **Role Filter Enhancement** -- The `getRoleBasedFilter` function needs to be integrated more deeply. Currently it is used in the dashboard API and CRUD factory, but dedicated query endpoints (sellers by admin, admin dashboard) need their own filters.

### 9.3 Schema Recommendations

1. Add `channels String[]` and `avgSales Int?` to User model
2. Consider adding a Proposal model if proposal feature is needed
3. Add indexes for common query patterns: `Order.sellerId`, `Sale.saleDate`, `Broadcast.scheduledAt`

---

## 10. Summary

### Progress Since v1 Report

| Area | v1 Score | v2 Score | Delta |
|---|:---:|:---:|:---:|
| Overall | 32% | 48% | **+16%** |
| Auth System | 55% | 80% | +25% |
| Statistics | 5% | 50% | +45% |
| Broadcast | 30% | 60% | +30% |
| Order Management | 25% | 40% | +15% |

### Key Improvements Since v1

1. Login and signup pages now fully implemented
2. Order paymentStatus and shippingStatus in schema and status update API
3. Broadcast start/end APIs with state validation
4. Dashboard page with KPI cards, sales chart, and seller ranking
5. Role-based data filtering integrated into CRUD factory

### Remaining Critical Gaps

1. **No Excel upload** -- the core order submission workflow in the original system
2. **No navigation layout** -- pages exist but users cannot navigate between them
3. **No order approval workflow** -- orders can be created but not approved/rejected
4. **User schema gap** -- channels/avgSales type mismatch
5. **No admin-specific views** -- admin dashboard, seller management
6. **No route protection** -- unauthenticated users can access main pages

### Effort to Parity

| Priority | Estimated Hours |
|---|:---:|
| P0 (Critical) | 17h |
| P1 (High) | 33h |
| P2 (Nice to Have) | 27h |
| **Total (excl. AI)** | **77h** |
| Total P0+P1 (functional parity) | **50h** |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-04-06 | Initial gap analysis | Claude Code |
| 2.0 | 2026-04-06 | Full re-analysis with current codebase state | Claude Code |

## Related Documents
- Previous Report: [gap-analysis-report.md](./gap-analysis-report.md)
- GAS Functions: [appscript-functions.md](./appscript-functions.md)
- Original Code: [original-code.gs](../appscript/original-code.gs)
- Prisma Schema: [schema.prisma](../../prisma/schema.prisma)
