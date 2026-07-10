# 슈퍼무진 페이지 렌더링 지연 진단 보고서

> **작성일**: 2026-07-10
> **작성 세션**: cowork
> **대상**: 다른 cowork/개발자가 이어받아 해결
> **관련 CLAUDE.md 학습**: #10 (OnewmsStockSync 13,104건 브라우저 OOM crash)

---

## 1. 문제 요약

MASTER 계정에서 다음 페이지들이 매우 느리게 렌더링되거나 랜딩이 안 됨.

- `/admin/sync-monitor` — 랜딩 자체가 안 되는 수준 ⚠️
- `/dashboard` — 매우 느리게 렌더링 (이미 부분 개선됨, commit `aa67945`)
- 기타 페이지 — 사용자 정확한 재현 목록 미확정 (추가 확인 필요)

---

## 2. 페이지별 위험도

프론트 초기 fetch 개수 × 백엔드 Promise.all 병목 조합 기준.

| 페이지 | 프론트 fetch | 백엔드 병목 API | 위험도 | 조치 상태 |
|---|---|---|---|---|
| `/admin/sync-monitor` | 4 | 6쿼리 + `getStockConflicts` 대량 조인 | 🔴 매우 높음 | ✅ **옵션 A 적용 (2026-07-10, §11)** |
| `/dashboard` | 2 | 8쿼리 Sale.aggregate | 🟡 개선됨 | commit `aa67945` |
| `/orders` | 7 | 8쿼리 | 🟠 높음 | 미조치 |
| `/centers` | 6 | 6쿼리 | 🟡 중 | 미조치 |
| `/broadcasts` | 6 | 4쿼리 | 🟡 중 | 미조치 |
| `/users` | 4 | 12쿼리 (개별 상세) | 🟠 상세 진입 시 지연 | 미조치 |
| `/products`, `/proposals` 등 | 2~3 | 5~9쿼리 | 🟢 대체로 빠름 | — |

### 백엔드 API 병목 순위 (Promise.all + 무거운 쿼리)

| 순위 | API 라우트 | 병렬 쿼리 수 |
|---|---|---|
| 1 | `app/api/users/[id]/route.ts` | 12 |
| 2 | `app/api/proposals/samples/route.ts` | 9 |
| 3 | `app/api/orders/route.ts` | 8 |
| 4 | `app/api/stats/dashboard/route.ts` | 8 |
| 5 | `app/api/onewms/stats/route.ts` | 7 |
| 6 | `app/api/admin/center-products/route.ts` | 7 |
| 7 | `app/api/users/[id]/stats/route.ts` | 7 |
| 8 | `app/api/admin/sync-monitor/route.ts` | 6 |
| 9 | `app/api/centers/[id]/delete-impact/route.ts` | 6 |
| 10 | `app/api/broadcasts/[id]/start/route.ts` | 6 |

---

## 3. `/admin/sync-monitor` 상세 진단

### 코드 위치

- 프론트: `app/(main)/admin/sync-monitor/page.tsx`
- 백엔드: `app/api/admin/sync-monitor/route.ts:30`

### 병목 6개 쿼리 (Promise.all)

```ts
const [cronLogs, conflictCount, failedOrderCount, conflicts, conflictTrend, lastHealthcheck] =
  await Promise.all([
    // 1. cronLogs — 인덱스 OK
    prisma.auditLog.findMany({
      where: { entityId: 'cron-stock-sync', ipAddress: 'cron' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // 2. conflictCount — 전체 테이블 스캔 ⚠️
    prisma.onewmsStockSync.count({
      where: { syncStatus: 'conflict' },
    }),

    // 3. failedOrderCount — 전체 스캔 ⚠️
    prisma.onewmsOrderMapping.count({
      where: { status: 'failed' },
    }),

    // 4. conflicts — 매우 무거움 ⭐⭐⭐
    getStockConflicts(),

    // 5. conflictTrend — 7일치 GROUP BY raw SQL
    prisma.$queryRaw`
      SELECT TO_CHAR("syncedAt"::date, 'YYYY-MM-DD') as date,
             COUNT(*)::int as count
      FROM "OnewmsStockSync"
      WHERE "syncStatus" = 'conflict'
        AND "syncedAt" >= NOW() - INTERVAL '7 days'
      GROUP BY "syncedAt"::date
    `,

    // 6. lastHealthcheck — 인덱스 OK
    prisma.auditLog.findFirst({
      where: { entityId: 'healthcheck' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
```

### 근본 원인

1. **`getStockConflicts()` 가 전체 conflict 를 productName 조인해서 반환** — CLAUDE.md 학습 #10 재현 케이스. 옵션 A 정책(1분 cron 매번 sync 기록) 도입 후 `OnewmsStockSync` 레코드가 수십만~수백만 누적 가능.
2. **Promise.all 특성** — 가장 느린 쿼리(`getStockConflicts`) 완료까지 전체 응답 대기.
3. **프론트에서 단일 API 응답 대기** — 부분 렌더 안 됨.

### 데이터 규모 추정 (2026-05-14 기준 CLAUDE.md 학습 #10)

> "OnewmsStockSync 의 모든 conflict row 카운트 (중복 포함, 13,000+ 부풀려짐)"

이후 1분 cron 도입되어 sync 이력이 대량 누적 → 지금은 훨씬 많을 것으로 추정.

---

## 4. 개선 방안 4가지

### 옵션 A — sync-monitor 만 우선 정리 (즉시, 45분)

**작업**:
1. API 를 3개 endpoint 로 분할
   - `/api/admin/sync-monitor/summary` — 요약 카드 (가볍고 빠름)
   - `/api/admin/sync-monitor/conflicts?limit=20&cursor=X` — 페이지네이션
   - `/api/admin/sync-monitor/trend` — 7일 추세 (별도)
2. `getStockConflicts()` 에 `limit=20` 강제 + 커서 기반 페이지네이션
3. 프론트에서 각각 개별 `fetch` → summary 카드 먼저 표시, conflicts/trend 는 별도 스켈레톤

**패턴 참고**: `app/(main)/dashboard/page.tsx` commit `aa67945` — Promise.all 해체 후 개별 fetch. 동일 패턴 적용 가능.

**리스크**: 없음. 기존 데이터 영향 X.

### 옵션 B — 무거운 페이지 3~4개 일괄 정리 (2~3시간)

**대상**:
- `/admin/sync-monitor` (옵션 A)
- `/orders` — 필터/페이지네이션 강화
- `/users/[id]` — 12쿼리 병렬을 필요 시점에만 lazy load
- `/centers` — 통계는 별도 endpoint

**리스크**: 프론트 상태 관리 복잡도 증가. 각 페이지 컴포넌트 리팩터 필요.

### 옵션 C — 백엔드 근본 쿼리 최적화 + 캐시 (4시간+)

**작업**:
1. **인덱스 재점검**
   - `OnewmsStockSync(syncStatus, syncedAt)` 복합 인덱스
   - `OnewmsOrderMapping(status)` 인덱스
   - `Sale(saleDate, sellerId)` 복합 인덱스
   - `AuditLog(entityId, ipAddress, createdAt)` 복합 인덱스
2. **count 4회 → GROUP BY 통합**
   - `/api/onewms/stats` 의 4개 count 를 단일 raw SQL GROUP BY 로
3. **캐시 도입 (5분 TTL)**
   - Vercel KV 또는 in-memory LRU
   - sync-monitor summary 는 캐시 안전 (실시간성 낮음)
   - dashboard 통계도 캐시 가능
4. **`getStockConflicts()` 재작성**
   - 매번 findMany + productName 조인 대신
   - 캐시 + 페이지네이션

**리스크**: DB 마이그레이션 (인덱스 추가) 필요. Neon 운영 DB 영향 검토.

### 옵션 D — 데이터 정리 cron 신설 (1시간, 자연 완화)

**작업**:
1. 새 cron: `/api/cron/cleanup-onewms-sync` (매일 새벽)
2. `OnewmsStockSync` 30일 이후 삭제 (또는 monthly aggregate 로 요약 후 원본 삭제)
3. `OnewmsOrderMapping` 실패 상태 90일 이후 삭제
4. `AuditLog` 대량 데이터 정리 정책

**vercel.json 예시**:
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-onewms-sync",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**리스크**: 이력 손실. 삭제 정책 사용자/한국무진 확인 필요.

---

## 5. 권장 진행 순서

### Phase 1 (오늘, 45분) — 즉시 체감 개선
- 옵션 A: `/admin/sync-monitor` 만 우선 정리
- **완료 기준**: sync-monitor 페이지가 3초 이내 초기 렌더

### Phase 2 (내일, 2~3시간) — 무거운 페이지 정리
- 옵션 B 적용: orders, users, centers
- 각 페이지에 skeleton + 부분 렌더 UX 도입

### Phase 3 (다음 주, 4시간+) — 근본 해결
- 옵션 C 적용: 인덱스 + GROUP BY 통합 + 캐시
- 옵션 D 병행: 데이터 정리 cron

---

## 6. 옵션 A 상세 구현 가이드 (다른 cowork 즉시 시작 가능)

### 6.1 백엔드 — API 3개 분할

#### `/api/admin/sync-monitor/summary/route.ts` (신규)

```ts
import { NextRequest } from 'next/server';
import { withRole, type AuthUser } from '@/lib/api/middleware';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

// 가벼운 요약만 — count 4개 GROUP BY 로 통합
export const GET = withRole(['MASTER'], async (_req: NextRequest, _user: AuthUser) => {
  const [statusCounts, mappingStatusCounts, cronLog, healthcheck] = await Promise.all([
    // 1번 쿼리로 여러 count 통합
    prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT "syncStatus" as status, COUNT(*)::bigint as count
      FROM "OnewmsStockSync"
      GROUP BY "syncStatus"
    `,
    prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*)::bigint as count
      FROM "OnewmsOrderMapping"
      GROUP BY status
    `,
    prisma.auditLog.findFirst({
      where: { entityId: 'cron-stock-sync', ipAddress: 'cron' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, metadata: true },
    }),
    prisma.auditLog.findFirst({
      where: { entityId: 'healthcheck' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, metadata: true },
    }),
  ]);

  const conflictCount = Number(statusCounts.find((s) => s.status === 'conflict')?.count ?? 0);
  const failedOrders = Number(mappingStatusCounts.find((s) => s.status === 'failed')?.count ?? 0);

  return ok({
    lastSyncTime: cronLog?.createdAt?.toISOString() ?? null,
    lastSyncDuration: (cronLog?.metadata as any)?.durationMs ?? null,
    lastHealthcheckTime: healthcheck?.createdAt?.toISOString() ?? null,
    matchRate: (healthcheck?.metadata as any)?.matchRate ?? null,
    activeConflicts: conflictCount,
    failedOrders,
  });
});
```

#### `/api/admin/sync-monitor/conflicts/route.ts` (신규 — 페이지네이션)

```ts
export const GET = withRole(['MASTER'], async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
  const cursor = searchParams.get('cursor');

  // 매번 전체 조회 대신 커서 기반 페이지네이션
  const conflicts = await prisma.onewmsStockSync.findMany({
    where: { syncStatus: 'conflict' },
    orderBy: { syncedAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true, productId: true, productCode: true, availableQty: true,
      localQty: true, difference: true, syncedAt: true,
    },
  });

  const hasMore = conflicts.length > limit;
  const items = hasMore ? conflicts.slice(0, limit) : conflicts;

  // productName 은 배치로 한 번에 조회
  const productIds = items.map((c) => c.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(products.map((p) => [p.id, p.name]));

  return ok({
    items: items.map((c) => ({
      ...c,
      productName: nameMap.get(c.productId) ?? 'Unknown',
      onewmsQty: c.availableQty,
    })),
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
});
```

#### `/api/admin/sync-monitor/trend/route.ts` (신규)

```ts
export const GET = withRole(['MASTER'], async () => {
  const trend = await prisma.$queryRaw<Array<{ date: string; count: number }>>`
    SELECT TO_CHAR("syncedAt"::date, 'YYYY-MM-DD') as date,
           COUNT(*)::int as count
    FROM "OnewmsStockSync"
    WHERE "syncStatus" = 'conflict'
      AND "syncedAt" >= NOW() - INTERVAL '7 days'
    GROUP BY "syncedAt"::date
    ORDER BY "syncedAt"::date
  `;
  return ok({ trend });
});
```

### 6.2 프론트 — 개별 fetch (Dashboard 패턴)

`app/(main)/admin/sync-monitor/page.tsx` 개선:

```tsx
export default function SyncMonitorPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [trend, setTrend] = useState<Trend[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [conflictsLoading, setConflictsLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    // 3개 독립 fetch — 먼저 오는 응답부터 부분 렌더
    fetch('/api/admin/sync-monitor/summary')
      .then((r) => r.json())
      .then((d) => setSummary(d.data))
      .finally(() => setSummaryLoading(false));

    fetch('/api/admin/sync-monitor/conflicts?limit=20')
      .then((r) => r.json())
      .then((d) => setConflicts(d.data.items))
      .finally(() => setConflictsLoading(false));

    fetch('/api/admin/sync-monitor/trend')
      .then((r) => r.json())
      .then((d) => setTrend(d.data.trend))
      .finally(() => setTrendLoading(false));
  }, []);

  return (
    <div>
      {summaryLoading ? <SummarySkeleton /> : <SummaryCards data={summary} />}
      {trendLoading ? <TrendSkeleton /> : <TrendChart data={trend} />}
      {conflictsLoading ? <TableSkeleton /> : <ConflictsTable items={conflicts} />}
    </div>
  );
}
```

### 6.3 기존 API 유지 (호환성)

기존 `/api/admin/sync-monitor` GET 은 **삭제하지 말고 유지**. 이유:
- 다른 곳에서 호출할 수 있음
- 신규 3개 endpoint 안정화 후 deprecate

---

## 7. 참고 커밋

- **`aa67945`** — Dashboard 렌더 병목 해소 (Promise.all 해체 → 개별 fetch)
  - 이번 옵션 A 의 동일 패턴 참고

---

## 8. 사용자 확인 필요 사항

다른 cowork 에서 옵션 A 진행 전 확인 부탁드립니다.

1. **정확한 재현 페이지 목록**
   - sync-monitor 외에 완전 랜딩 안 되는 페이지가 더 있나요?
   - `/orders`, `/users`, `/centers` 도 랜딩 자체가 안 되는지 아니면 매우 느린 렌더인지

2. **OnewmsStockSync 현재 row 수**
   - 대략 몇 만~몇 십만인지 (DB 관리자 확인 or 진단 스크립트 실행)
   - 대량이면 옵션 D 데이터 정리도 동시 진행

3. **sync-monitor 사용 빈도**
   - 매일 사용하는 화면인지, 특정 상황(장애 시)만 열어보는지
   - 사용 빈도 낮으면 캐시 5~10분 TTL 도입해도 무방

---

## 9. 관련 파일

### 진단 대상
- `app/(main)/admin/sync-monitor/page.tsx` — 프론트
- `app/api/admin/sync-monitor/route.ts` — 백엔드 (병목 위치)
- `lib/services/onewms/stockSync.ts:400-450` — `getStockConflicts()` 정의

### 개선 참고 (이미 개선됨)
- `app/(main)/dashboard/page.tsx` (commit `aa67945`) — 동일 패턴 개선 예시
- `app/api/stats/dashboard/route.ts` — 참고 백엔드 구조

### 관련 정책 문서
- `CLAUDE.md` 학습 #10 — OnewmsStockSync 대량 조회 브라우저 OOM crash 사례
- `CLAUDE.md` 학습 #24 — ONEWMS 100% 자동 일치 정책 (옵션 A)
- `docs/onewms/SUMMARY.md` — ONEWMS 통합 현황

---

## 10. 예상 완료 시간

| 옵션 | 시간 | 체감 개선 |
|---|---|---|
| A (sync-monitor 만) | 45~60분 | sync-monitor 3초 이내 렌더 |
| B (무거운 페이지 3~4개) | 2~3시간 | 전체 페이지 체감 개선 |
| C (근본 최적화) | 4시간+ | 실제 API 응답 속도 2~5배 |
| D (데이터 정리) | 1시간 | 자연 완화, 장기 유지 |

**우선 옵션 A → 확인 → 필요 시 B/C/D 순차 진행 권장.**

---

_다른 cowork/개발자 인수인계용. 문의는 박진우 대표에게._

---

## 11. 조치 이력

### 2026-07-10 — 옵션 A 적용 완료 (cowork)

**변경 파일**:
- `app/api/admin/sync-monitor/summary/route.ts` (신규) — 요약 카드 + cron 이력. conflict/failed count 는 GROUP BY 1회로 통합
- `app/api/admin/sync-monitor/conflicts/route.ts` (신규) — 커서 페이지네이션 (기본 20 / 최대 100), productName 은 페이지 분량만 배치 조회
- `app/api/admin/sync-monitor/trend/route.ts` (신규) — 7일 충돌 추이 분리
- `app/(main)/admin/sync-monitor/page.tsx` — 3개 독립 fetch + 섹션별 스켈레톤 부분 렌더 + "더보기" 버튼. 부수 수정: 렌더 중 조건부 return(hooks 순서 위반 소지) → useEffect redirect 로 변경
- 기존 `/api/admin/sync-monitor` GET/POST 는 호환성 위해 유지 (§6.3 방침)

**검증**: `tsc --noEmit` 통과, `eslint` 에러 0 (경고는 기존 route.ts 와 동일한 `_req`/`_user` unused 뿐).

**남은 것**:
- `pnpm build` + 운영 도메인(www.supermujin.ai) MASTER 계정 실제 렌더 확인 — CLAUDE.md 학습 #12 배포 체크리스트 준수
- §8 사용자 확인 사항 여전히 유효 (OnewmsStockSync row 수 확인 → 대량이면 옵션 D 병행 권장)
- Phase 2/3 (옵션 B/C/D) 미착수

### 2026-07-10 — 2차 진단: 옵션 A 배포 후에도 랜딩 느림 → 근본 원인 실측 (cowork)

**운영 DB 실측 결과** (§8-2 질문에 대한 답):

| 항목 | 실측값 |
|---|---|
| `OnewmsStockSync` 행 수 | **55,917,208 행 (10GB, 인덱스 포함 ~13GB)** |
| 행 분포 (pg_stats) | synced 99.96% / resolved 0.04% / **conflict ≈ 0** |
| 최근 유입 | 1일 10행, 7일 189행 (6/10 "변경분만 기록" 최적화 이후 미미) |
| 누적 기간 | 2026-04-22 ~ 현재 (대부분 6/10 이전 매분 전상품 기록의 유산) |

**EXPLAIN 확인 — 풀스캔(Parallel Seq Scan) 쿼리들**:
1. summary 의 `GROUP BY syncStatus` (옵션 A 에서 추가한 것 포함 — count 통합해도 스캔 비용 동일)
2. conflicts `findMany WHERE syncStatus='conflict' ... LIMIT 21` — syncStatus 인덱스 부재로 LIMIT 에도 풀스캔
3. `/api/onewms/stats` 의 `COUNT(DISTINCT productId) WHERE syncStatus='conflict'` — **dashboard ONEWMS 위젯 지연도 동일 원인**
4. trend 쿼리는 syncedAt 인덱스 사용으로 정상 ✅

**2차 조치 (§11.2)**:
1. 운영 DB 인덱스 생성: `CREATE INDEX CONCURRENTLY "OnewmsStockSync_syncStatus_syncedAt_idx" ON "OnewmsStockSync" ("syncStatus", "syncedAt" DESC)` — 무중단
2. `prisma/schema.prisma` 에 `@@index([syncStatus, syncedAt(sort: Desc)])` 반영 (신규 DB 재현용, 운영은 이미 존재하므로 db push 시 no-op)
3. `summary/route.ts` — GROUP BY 풀스캔 → 인덱스 타는 조건 count 로 변경. **이 테이블에 WHERE 없는 count/GROUP BY 금지**
4. 데이터 삭제(55.8M synced 이력, 옵션 D)는 **보류** — 한국무진 이력 보존 정책 확인 후 진행. 인덱스만으로 체감 속도는 해결되나 스토리지 ~10GB 비용은 지속

**교훈**: "프론트 fetch 분리 + 페이지네이션" (옵션 A) 은 증상 완화일 뿐, 테이블이 수천만 행이면 인덱스 없는 필터 하나로 모든 endpoint 가 함께 느려진다. 느린 페이지 진단 시 ① 테이블 실측 행수 ② EXPLAIN 을 코드 수정보다 먼저 확인할 것.
