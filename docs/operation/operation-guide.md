# 운영 가이드 (Operation Guide)

> Live Commerce Platform 운영 및 모니터링 가이드

---

## 📋 목차

1. [시스템 모니터링](#시스템-모니터링)
2. [로그 관리](#로그-관리)
3. [장애 대응](#장애-대응)
4. [백업 및 복구](#백업-및-복구)
5. [성능 튜닝](#성능-튜닝)
6. [정기 점검](#정기-점검)

---

## 📊 시스템 모니터링

### Vercel Analytics

**접근 방법**:
1. Vercel Dashboard → 프로젝트 선택
2. **Analytics** 탭 클릭

**주요 메트릭**:
- **페이지 뷰**: 일일/주간/월간 트래픽
- **방문자 수**: Unique visitors
- **페이지 로드 시간**: p50, p75, p95, p99
- **오류율**: 4xx, 5xx 응답 비율

**알람 설정**:
- Error rate > 5% → Slack 알림
- p99 latency > 3000ms → Email 알림

---

### Database 모니터링 (Neon)

**Neon Console**: [https://console.neon.tech/](https://console.neon.tech/)

**모니터링 항목**:
| 메트릭 | 정상 범위 | 경고 임계값 |
|--------|----------|-----------|
| Storage | < 80% | > 90% |
| Connections | < 50 | > 80 |
| CPU Usage | < 70% | > 90% |
| Query Time (p95) | < 500ms | > 1000ms |

**Slow Query 분석**:
```sql
-- PostgreSQL에서 실행
SELECT
  query,
  calls,
  total_time / calls AS avg_time,
  max_time,
  stddev_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

---

### Redis 모니터링 (Upstash)

**Upstash Console**: [https://console.upstash.com/](https://console.upstash.com/)

**모니터링 항목**:
- Daily Requests: < 100K (Free tier 제한)
- Cache Hit Rate: > 80% 목표
- Memory Usage: < 80%
- Command Latency: < 10ms

**Rate Limiting 통계**:
```bash
# Vercel Function Logs에서 확인
# ratelimit:* 패턴 검색
```

---

## 📝 로그 관리

### Vercel Function Logs

**실시간 로그 확인**:
```bash
# Vercel CLI 설치
npm i -g vercel

# 로그 실시간 조회
vercel logs --follow

# 특정 함수 로그만 보기
vercel logs --follow --filter="function:api"

# 에러 로그만 보기
vercel logs --follow --filter="level:error"
```

---

### 로그 레벨

**Security Logger** (`lib/logger.ts`):
```typescript
// 인증 실패
securityLogger.authFailed({ reason: "invalid_password", email });

// 의심스러운 활동
securityLogger.suspiciousActivity({ action: "multiple_failed_logins", ip });
```

**Application Logs**:
```typescript
// Development
console.log("[DEBUG]", data);

// Production (자동 필터링)
if (process.env.NODE_ENV === "development") {
  console.log("[DEBUG]", data);
}
```

---

### 로그 보관 정책

**Vercel 로그 보관 기간**:
- Free tier: 1일
- Pro tier: 7일
- Enterprise tier: 30일

**장기 보관 필요 시**:
- Datadog 연동
- AWS CloudWatch 연동
- 자체 로그 수집 시스템 구축

---

## 🚨 장애 대응

### 장애 분류

| Level | 영향 범위 | 대응 시간 | 예시 |
|-------|----------|----------|------|
| **P0** | 전체 서비스 | 15분 이내 | Database 다운, 인증 불가 |
| **P1** | 주요 기능 | 1시간 이내 | 발주 실패, ONEWMS 연동 오류 |
| **P2** | 부분 기능 | 4시간 이내 | 시세 조회 실패, AI 분석 오류 |
| **P3** | 경미한 문제 | 1일 이내 | UI 버그, 통계 오류 |

---

### P0 장애 대응 프로세스

**1. 인지 (Detection)**:
- Vercel 알림 수신
- Uptime monitoring 알림
- 사용자 신고

**2. 초동 대응 (Immediate Response)** - 15분:
```bash
# 1) 장애 확인
vercel logs --follow --filter="level:error"

# 2) 상태 페이지 업데이트
# https://status.your-domain.com (별도 설정 필요)

# 3) 긴급 팀 소집
# Slack #emergency 채널 알림
```

**3. 원인 파악 (Root Cause Analysis)** - 30분:
- Vercel Logs 분석
- Database 상태 확인
- External API 상태 확인 (ONEWMS, Naver, etc.)

**4. 복구 (Recovery)** - 1시간:
```bash
# Database 연결 실패 시
# → Neon Console에서 compute 재시작

# 코드 버그 시
# → Rollback to previous deployment
vercel rollback

# 환경변수 오류 시
# → Vercel Dashboard에서 수정 후 재배포
```

**5. 사후 분석 (Post-Mortem)**:
- 장애 원인 문서화
- 재발 방지 조치
- 팀 공유 및 학습

---

### P1 장애: ONEWMS 연동 오류

**증상**:
- 발주 동기화 실패
- 재고 업데이트 안 됨

**대응**:
```bash
# 1) ONEWMS API 상태 확인
curl https://onewms-api.example.com/health

# 2) Retry queue 확인
# Vercel Dashboard → Functions → onewms/orders/retry

# 3) Manual sync
curl -X POST https://your-domain.vercel.app/api/onewms/orders/sync \
  -H "Authorization: Bearer <token>" \
  -d '{"orderId":"order_123"}'

# 4) Cron job 재실행
curl https://your-domain.vercel.app/api/cron/stock-sync \
  -H "Authorization: Bearer <CRON_SECRET>"
```

---

### P2 장애: Rate Limit 초과

**증상**:
- 429 Too Many Requests 에러
- 사용자 불만 접수

**대응**:
```bash
# 1) Redis에서 rate limit 확인
# Upstash Console → Metrics

# 2) 일시적으로 제한 완화 (긴급 시)
# lib/rateLimit.ts 수정 후 배포
# export const apiRateLimit = new Ratelimit({
#   limiter: Ratelimit.slidingWindow(200, "1 m"), // 100 → 200
# });

# 3) 악의적 사용자 차단
# IP 기반 차단 (Vercel Firewall - Enterprise)
```

---

## 💾 백업 및 복구

### Database 백업

**자동 백업 (Neon)**:
- **주기**: 매일 자정 (UTC)
- **보관 기간**: 7일 (Pro tier)
- **복구 방법**: Point-in-Time Recovery (PITR)

**수동 백업**:
```bash
# pg_dump로 백업
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Vercel Blob에 업로드 (선택사항)
# https://vercel.com/docs/storage/vercel-blob
```

---

### Point-in-Time Recovery

**복구 절차**:
1. Neon Console → 프로젝트 선택
2. **Restore** → **Point-in-Time**
3. 복구 시점 선택 (최근 7일 이내)
4. 새 branch 생성 (기존 데이터 보존)
5. 검증 후 Production branch로 promote

**복구 시간**: 5-30분 (데이터 크기에 따라)

---

### 코드 롤백

**Vercel Deployment Rollback**:
```bash
# CLI로 rollback
vercel rollback

# Dashboard에서 rollback:
# Deployments → 이전 배포 선택 → Promote to Production
```

**Git 롤백**:
```bash
# 이전 커밋으로 되돌리기
git revert HEAD
git push origin main

# 또는 강제 rollback (주의!)
git reset --hard <commit-hash>
git push --force origin main
```

---

## ⚡ 성능 튜닝

### API 응답 시간 최적화

**목표**:
- p50 < 500ms
- p95 < 2000ms

**최적화 전략**:

1. **Database 인덱스 추가**:
```sql
-- 자주 조회되는 컬럼에 인덱스 추가
CREATE INDEX CONCURRENTLY idx_order_seller_date
  ON "Order" (sellerId, uploadedAt);

-- 복합 인덱스로 필터링 성능 개선
CREATE INDEX CONCURRENTLY idx_product_category_stock
  ON "Product" (category, totalStock);
```

2. **Redis 캐싱 확대**:
```typescript
// lib/cache/redis.ts
// 시세 정보 캐싱 (1시간)
const cacheKey = `pricing:${barcode}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... fetch from API
await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

3. **N+1 쿼리 방지**:
```typescript
// ❌ Bad: N+1 query
const orders = await prisma.order.findMany();
for (const order of orders) {
  const seller = await prisma.user.findUnique({ where: { id: order.sellerId } });
}

// ✅ Good: Single query with include
const orders = await prisma.order.findMany({
  include: { seller: true }
});
```

---

### Vercel Function 최적화

**Region 설정**:
```typescript
// app/api/route.ts
export const runtime = 'edge'; // Edge Runtime for faster cold starts
export const preferredRegion = ['sin1', 'icn1']; // Singapore + Seoul
```

**Timeout 설정**:
```json
// vercel.json
{
  "functions": {
    "app/api/onewms/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

---

## 📅 정기 점검

### 일일 점검 (Daily)

**시간**: 매일 오전 9시

- [ ] Vercel Analytics 확인 (Error rate, Latency)
- [ ] Database 연결 상태 확인 (Neon Console)
- [ ] Cron Jobs 실행 로그 확인
- [ ] Redis 사용량 확인 (Upstash Console)

---

### 주간 점검 (Weekly)

**시간**: 매주 월요일 오전 10시

- [ ] npm audit 실행 (취약점 스캔)
- [ ] Database Slow Query 분석
- [ ] API 벤치마크 실행 (`scripts/performance/api-benchmark.ts`)
- [ ] Vercel Analytics 주간 리포트 검토
- [ ] Error tracking 리뷰 (Sentry 등)

---

### 월간 점검 (Monthly)

**시간**: 매월 1일 오전 10시

- [ ] Database 백업 검증 (복구 테스트)
- [ ] 환경변수 검증 (`scripts/security/validate-env.ts`)
- [ ] API Key rotation (분기별 - 3개월마다)
- [ ] 사용자 권한 검토 (Role 재확인)
- [ ] 성능 목표 달성 여부 확인 (Lighthouse, API 응답 시간)
- [ ] Dependency 업데이트 (`npm outdated`)

---

### 분기별 점검 (Quarterly)

**시간**: 분기 첫째 주

- [ ] 보안 감사 (Security Audit)
- [ ] 재해 복구 훈련 (DR Drill)
- [ ] 성능 벤치마크 및 최적화
- [ ] 문서 업데이트 (API Reference, Deployment Guide)
- [ ] 팀 교육 및 지식 공유

---

## 🔔 알림 설정

### Vercel 알림

**설정 경로**: Vercel Dashboard → **Settings** → **Notifications**

**권장 알림**:
- Deployment Failed → Slack
- Domain Issues → Email
- Function Errors > 100/hour → Slack
- Monthly Usage 80% → Email

---

### Uptime Monitoring

**추천 도구**: [UptimeRobot](https://uptimerobot.com/) (Free tier)

**모니터링 대상**:
- `https://your-domain.vercel.app/` (5분마다)
- `https://your-domain.vercel.app/api/health` (5분마다)

**알림 채널**:
- Email + Slack

---

## 📞 긴급 연락망

| 역할 | 담당자 | 연락처 | 대응 범위 |
|------|--------|--------|----------|
| **On-Call Engineer** | - | - | P0/P1 장애 대응 |
| **Database Admin** | - | - | Database 이슈 |
| **Security Lead** | - | - | 보안 사고 |
| **Product Owner** | - | - | 비즈니스 의사결정 |

---

## 📚 참고 자료

- [Vercel 모니터링 가이드](https://vercel.com/docs/analytics)
- [Neon 모니터링 가이드](https://neon.tech/docs/introduction/monitoring)
- [Upstash Redis 모니터링](https://docs.upstash.com/redis/features/observability)
- [성능 최적화 가이드](../performance/optimization-guide.md)

---

**Last Updated**: 2026-04-14
**Maintained By**: Operations Team
