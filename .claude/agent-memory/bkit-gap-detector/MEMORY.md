# Gap Detector Memory - Live Commerce Project

## Project Context
- Migration: Google Apps Script v3.4 (71 functions) -> Next.js 16 + React 19 + Neon PostgreSQL
- Overall implementation: ~92% as of 2026-04-06 (v6 final analysis)
- Reports: v1-v3 in `docs/analysis/`, v5 in `docs/03-implementation/gap-analysis-report-v5.md`, v6 in `docs/03-check/gap-analysis-final-100.md`

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

### Category Scores
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

## Remaining Issues - NONE (core)
- All previous issues resolved (SQL injection, home redirect, sidebar links, missing functions)
- Only `confirmed` boolean on Broadcast model not added (accepted as design decision)
- 7 partial matches are architectural paradigm differences, not functional gaps
- 8 AI/Cache functions deferred to Phase 3 (requires external API keys)

## Architecture Pattern
- Dynamic level: components, hooks, lib, types, utils
- Consistent `withRole()` middleware on all 28 API routes
- `ok()` / `errors.*` response helpers everywhere
- Zod validation on all write endpoints
- Role-based access: seller=own, admin=team, master=all
- 7 Prisma models: User, Product, Order, OrderItem, Broadcast, Sale, Proposal + RateLimit

## Lessons
- CRUD factory covers basic CRUD; stats/analytics/bulk ops need custom routes
- Weekly comparison was correctly merged into seller/analytics (avoid endpoint fragmentation)
- Prisma schema must match TypeScript types exactly to avoid runtime undefined
- react-big-calendar requires date-fns localizer setup for Korean locale
- AI features (5 functions) and Cache (3 functions) explicitly deferred to Phase 3
- Always use parameterized $queryRaw (tagged templates), never $queryRawUnsafe
- Barcode normalization: uppercase + strip whitespace + remove special chars + trim leading zeros
- Batch operations: use $transaction with per-item try/catch for partial success reporting
