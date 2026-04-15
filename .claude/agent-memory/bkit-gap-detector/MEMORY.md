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
