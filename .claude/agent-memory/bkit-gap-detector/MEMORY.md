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

## Barcode Scanner UI Analysis (2026-04-15, v6)

### Base Match Rate: 96% (v5 FINAL) -- v1: 66%, v2: 88%, v3: 90%, v4: 94%, v5: 96%
### AI/Pricing UI Match Rate: 90% (v6) -- 2 P0 bugs found
- Design doc: `docs/02-design/features/barcode-ui.design.md` (1460 lines)
- Plan doc: `.claude/plans/snoopy-purring-ritchie.md` (AI Price Comparison integration)
- Report: `docs/03-analysis/barcode-ui.analysis.md` (v6)

### v6: AI/Pricing UI Integration (7 files)
- QueryProvider.tsx: 100% match
- usePriceComparison.ts: 70% -- **P0: response.json() not unwrapped from ok() envelope**
- useAIAnalysis.ts: 70% -- **P0: same ok() envelope bug**
- PriceComparisonCard.tsx: 95% -- full UI, but data access fails due to P0
- AIInsightsCard.tsx: 98% -- full UI + bonus re-analyze button
- ProductDetailsModal.tsx: 95% -- correctly imports and renders both cards in LOOKUP mode
- page.tsx: 100% -- BarcodeQueryProvider wrapper applied

### v6 P0 Bugs (2 items -- feature non-functional)
- P0-1: usePriceComparison returns `{ data: {...} }` but component accesses top-level
- P0-2: useAIAnalysis same pattern -- `data.pricing` is undefined, should be `data.data.pricing`
- Fix: `const json = await response.json(); return json.data;` in both hooks
- This is the 4th and 5th occurrence of the ok() envelope bug in this project

### v6 P1/P2 (backend convention)
- P1: /api/pricing/compare uses auth() not withRole() (4th feature with this gap)
- P1: /api/ai/analyze uses auth() not withRole()
- P2: Neither route uses Zod validation

### Base v5 ALL P0/P1/P2 RESOLVED (unchanged)

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
- Inline PrismaClient instantiation per route file is a severe anti-pattern causing connection pool waste -- always check for shared singleton import
- Design specifies `{success, data}` but project ok() returns `{data}` only -- barcode routes added `success: true` field inconsistently
- When design specifies optional field (String?) but schema has required (String), verify if all records can satisfy the constraint
- ScanType as Prisma enum is better than String type -- score as improvement over design
- Transaction wrapping scan log + stock update is an improvement not in design -- score as "added"
- New feature routes consistently skip conventions (3rd occurrence after ONEWMS and broadcast calendar)
- Convention fix pattern is repeatable: withRole + ok/errors + Zod + shared Prisma = +20-55% architecture/convention score improvement
- Barcode scanner v1->v2 confirms: P1 convention fixes alone produce +22% overall improvement (66%->88%)
- All three feature analyses (ONEWMS, broadcast-calendar, barcode-ui) follow identical convention-fix trajectory
- previousStock requires querying existing stock BEFORE the transaction, not after
- centerId filter in scan-history is a simple where-clause addition but was missed in initial impl
- Composite indexes with sort order (DESC) should be verified character-by-character in schema
- Previous analysis reports can have false negatives -- always re-verify "missing" items against current code
- `data.success` check is the #1 recurring client-side bug: design docs specify `{success, data}`, ok() returns `{data}` only
- The `data.success` bug pattern: response.ok passes -> data.success is undefined -> product/data never set -> UI appears broken
- Client-side correct pattern after ok(): check `data.data` or just use `data.data` directly (no success field exists)
- Features reported as "missing" in v2 were actually implemented (FlashlightToggle, CameraFlip, centerName, product image) -- always read actual files, never trust prior report summaries
- When design specifies separate components (FlashlightToggle, CameraFlip, ScanControls), implementation may integrate them into parent -- score as "acceptable" not "missing"
- v3 discovered P0 bugs that v1 and v2 missed because prior analyses focused on server-side convention compliance, not client-side data flow
- Always trace the full data path: API response shape -> hook parsing -> state setting -> component rendering
- P2 fixes (product detail Link, audit log) are small code changes but measurably improve design compliance (+2%)
- Universal audit logging requires the scanLog.create() to be BEFORE the error return, not after
- Design specifies `/products/${id}` but actual route structure may differ (e.g., `/admin/products/${id}`) -- route path alignment is an acceptable difference
- Barcode scanner v1->v5 complete trajectory: 66% -> 88% -> 90% -> 94% -> 96% over 5 iterations
- **CRITICAL**: Plan documents can contain the same ok() envelope bug -- implementing plan verbatim reproduces the bug
- React Query hooks that do `return response.json()` will return `{ data: T }` (ok envelope), not `T` directly
- The ok() envelope bug has now occurred 5 times in this project (useBarcodeScanner, useScanHistory, usePriceComparison, useAIAnalysis x2)
- When auditing new hooks, ALWAYS check: does the hook unwrap `json.data` or pass raw `response.json()`?
- Backend routes created for pre-existing services (pricing, AI) often skip withRole() because they predate the convention
- useMutation (React Query) returns `{ data, mutate, isPending }` where data = mutationFn return value -- same envelope issue applies
