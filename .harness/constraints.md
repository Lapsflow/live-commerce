# Architecture Constraints — live-commerce Extensions

> Base constraints: `.harness/base.md`
> This file: live-commerce specific additions

---

## Multi-Tenancy Rules
- ALL API routes use `createCrudHandlerPrisma` factory
- Role hierarchy: MASTER > SUB_MASTER > ADMIN > SELLER
- Center-based scoping via User.centerId
- Masters see all centers, others see assigned center only

## Integration Layer
- ONEWMS API integration (lib/services/onewms/)
- Marketplace APIs (Coupang, Naver)
- AI Analysis (Anthropic Claude)
- Google Sheets sync
- WebSocket support for real-time updates

## Security Layer
- NextAuth v5 with Credentials provider
- bcryptjs password hashing
- CSRF validation (Origin/Host headers)
- Role-based access control (RBAC)
- Rate limiting with Redis + DB fallback

## Prisma Gotchas
- Neon adapter requires `as any` casts (justified eslint-disable)
- Retry middleware for transient errors (100ms, 200ms backoff)
- Lazy initialization to reduce cold start
- Connection pooling configured
