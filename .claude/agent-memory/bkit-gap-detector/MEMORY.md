# Gap Detector Memory - Live Commerce Project

## Project Context
- Migration: Google Apps Script v3.4 (71 functions) -> Next.js 16 + React 19 + Neon PostgreSQL
- Overall implementation: ~92% as of 2026-04-06 (v6 final analysis)
- Reports: v1-v3 in `docs/analysis/`, v5 in `docs/03-implementation/gap-analysis-report-v5.md`, v6 in `docs/03-check/gap-analysis-final-100.md`
- ONEWMS integration report: `docs/03-analysis/onewms-integration.analysis.md` (v5 FINAL, 2026-04-15)

## Current State (v6 FINAL - 2026-04-06)

### Match Rate: 92% (all core gaps resolved)
- Core business logic (excl AI/Cache): 93%
- Full function coverage (incl deferred): 80%
- 43 fully implemented, 7 partial, 8 deferred, 13 N/A

### All P0, P1, P2 Resolved
- Phase 1 (P0 Critical): 5/5 done
- Phase 2 (P1 High): 7/7 done
- Phase 2+ (P2 Minor): 6/6 done (v6 closes all remaining)

### v6 New Implementations
1. normBarcode() - `lib/utils/barcode.ts`
2. Batch order deletion - `app/api/orders/bulk/route.ts`
3. User edit dialog - `components/users/user-edit-dialog.tsx`
4. Proposal GET/DELETE - `app/api/proposals/[id]/route.ts`

### Category Scores (base migration)
| Category | v5 | v6 | Change |
|---|---|---|---|
| Broadcasts | 99% | 99% | -- |
| Statistics | 94% | 94% | -- |
| Auth & Users | 83% | 87% | +4% |
| Orders | 78% | 84% | +6% |
| Products | 75% | 100% | +25% |
| Proposals | 100% | 100% | -- |
| AI/Market | 0% | 0% | deferred |
| Cache | 0% | 0% | deferred |

## ONEWMS Integration Analysis (2026-04-15, v5 FINAL)

### Match Rate: 100% (PASS) -- up from 97% in v4
- Design doc: `docs/02-design/features/onewms-integration.design.md` (1904 lines)
- Report: `docs/03-analysis/onewms-integration.analysis.md` (v5 FINAL, 2026-04-15)

### Category Scores
| Category | v4 | v5 | Change |
|---|---|---|---|
| Database Models | 100% | 100% | -- |
| ONEWMS Client Library | 100% | 100% | -- |
| Backend Services | 100% | 100% | -- |
| REST API Endpoints | 95% | 100% | +5% |
| Cron Jobs | 100% | 100% | -- |
| UI Components | 97% | 97% | -- |
| Environment Variables | 100% | 100% | -- |
| Architecture Compliance | 93% | 100% | +7% |
| Convention Compliance | 82% | 100% | +18% |

### ALL P1 and P2 Issues RESOLVED
- P1-1: `syncProductStock()` exported (v4)
- P1-2: Auto-resolve threshold `<= 5` (v4)
- P2-1: ok()/errors.* on all 10 endpoints (v5)
- P2-2: withRole() on all 10 endpoints (v5)
- P2-3: Zod validation on all 4 POST endpoints with body (v5)

### Remaining Items (P3 only)
- `FailedOrdersList.tsx` calls non-existent API endpoints (extra component)
- Design doc could be updated for response shapes, order format
- Unit tests at 0% (optional in design)
- AuthHandler type could accept 3rd params arg (minor TS)

## Architecture Pattern
- Dynamic level: components, hooks, lib, types, utils
- Consistent `withRole()` middleware on all API routes (ONEWMS now fully compliant)
- `ok()` / `errors.*` response helpers (ONEWMS now 10/10 compliant)
- Zod validation on write endpoints (ONEWMS now 4/4 compliant)
- Role-based access: seller=own, admin=team, master=all
- 14 Prisma models: User, Product, Order, OrderItem, Broadcast, Sale, Proposal, RateLimit + OnewmsOrderMapping, OnewmsStockSync, OnewmsDeliveryLog, Warehouse, BarcodeMaster, WarehouseInventory, StockMovement

## Phase 4 Broadcast Calendar Analysis (2026-04-15, v2 PASS)

### Match Rate: 91% (PASS) -- up from 82% in v1
- Report: `docs/03-analysis/phase-4-broadcast-calendar.analysis.md` (v2)
- Design doc: `docs/02-design/features/phase-4-broadcast-calendar.design.md`

### ALL P1 Issues RESOLVED (Phase A & B)
- P1-1: `data.success` -> `data.error` check in StartBroadcastDialog (v2)
- P1-2: BroadcastSalesTracker API connected, field names aligned (v2)
- P1-3: ProductListForBroadcast `centerId` prop added (v2)
- P1-4: Dead code removed (4 files + 1 directory) (v2)
- Bonus: validate-code route type error fixed (v2)

### Key Reclassifications
- HQ `active: true` filter: Product model has no `active` field -- design doc error
- Response `{success, data}`: ok() returns `{data}` only -- design doc error
- Stats endpoint: Sale.broadcastId relation EXISTS (TODO comment was wrong)

### Category Scores
| Category | v1 | v2 | Change |
|---|---|---|---|
| API Endpoints | 69% | 75% | +6% |
| Service Layer | 75% | 75% | -- |
| UI Components | 70% | 86% | +16% |
| Data Queries | 65% | 78% | +13% |
| Architecture | 78% | 85% | +7% |
| Convention | 85% | 85% | -- |

### Remaining P2/P3 Items
- P2: withRole() not on center routes (validate-code, check-available)
- P2: broadcastService.startBroadcast() exists but unused by route
- P2: Broadcast ID via URL splitting instead of params
- P2: getCenterByCode() missing _count include
- P2: No Zod validation on POST endpoints
- P3: Stats returns zeros (Sale model aggregation not wired)
- P3: Stylistic layout differences (flat vs Card-based)

## Lessons
- CRUD factory covers basic CRUD; stats/analytics/bulk ops need custom routes
- Weekly comparison was correctly merged into seller/analytics (avoid endpoint fragmentation)
- Prisma schema must match TypeScript types exactly to avoid runtime undefined
- react-big-calendar requires date-fns localizer setup for Korean locale
- AI features (5 functions) and Cache (3 functions) explicitly deferred to Phase 3
- Always use parameterized $queryRaw (tagged templates), never $queryRawUnsafe
- Barcode normalization: uppercase + strip whitespace + remove special chars + trim leading zeros
- Batch operations: use $transaction with per-item try/catch for partial success reporting
- New feature integrations (like ONEWMS) often skip project conventions (withRole, Zod, ok/errors) -- convention compliance check is essential
- When design specifies internal function as public API, verify export status in implementation
- Off-by-one in threshold comparisons (`<` vs `<=`) is a common design-implementation gap
- Additional UI components beyond design are enhancements, not gaps -- score as "added"
- ONEWMS cron jobs correctly use CRON_SECRET bearer token pattern (not withRole)
- P1 gaps can persist across analysis versions; always verify if prior recommendations were applied
- v3 delta: zero changes v2->v3. v4 delta: both P1 fixes applied. v5 delta: all P2 convention fixes applied
- When verifying fixes, check both the service-level code AND the API route that wires it through
- Per-product sync requires both: function export + API route parameter handling
- Convention refactoring is best verified by grep: `NextResponse` should return 0 matches, `withRole` should match all routes
- AuthHandler type with 2 params works at runtime when handler receives 3 args (JS ignores extras), but is a TS type imprecision
- Zod validation is N/A for POST endpoints with no request body (e.g., retry-all patterns)
- Design docs may specify `{success, data}` response format but project ok() returns `{data}` only -- always verify response shape consistency
- When components exist in multiple locations (design location vs actual import), check which one the page actually imports
- Dead code copies matching design exactly can inflate perceived compliance -- always trace actual imports
- Service files can exist but be unused by their intended route (inline Prisma in route handler instead)
- URL string splitting for param extraction (`req.url.split("/")`) is fragile -- always use Next.js params pattern
- Broadcast stats endpoints need Broadcast-Order schema relation to return real data
- Always verify Prisma schema for field existence before scoring design-impl gaps (e.g., `active` field may not exist)
- Sale.broadcastId provides Broadcast-Sale relation -- stats can use Sale model, not Order
- `data.error` is the correct client-side check pattern for ok()/errors.* response convention
- When reclassifying design doc errors, the implementation score should increase (not count as impl gap)
- Phase A/B fixes can produce +9% improvement when all P1 items are addressed simultaneously
- TODO comments in code can be factually wrong (e.g., "no relation exists" when it does) -- always verify schema
