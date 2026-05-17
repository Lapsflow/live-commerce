# 발주 엑셀 업로드 — 근본 해결 PRD (Phase 1)

> 작성: 2026-05-17
> 목표: 192초 hang → 30초 안에 응답 + 진행률 + 중복 방어
> 제외: 비동기화 (법적 우려 — 재고 부족 시 사후 거부 불가, 발주 전 ONEWMS API 로 확인 필수)

---

## 1. 배경

### 현재 문제
- 신윤송 운영자: 18건 엑셀 업로드 → 192초 동안 "처리 중..." → 중복 클릭 → 중복 발주 가능성
- Vercel 로그: POST /api/orders/bulk Duration 192941ms → 400 (마지막 1건만, 나머지는 200 성공)
- 백엔드는 INSERT 성공하지만 너무 느려서 운영자가 "고장" 으로 오해

### 근본 원인
1. **16건 같은 product 의 reserveStock 직렬 호출** → Serializable conflict 누적 → retry backoff 폭발
2. **ONEWMS fetch timeout 없음** → 외부 hang 시 무한 대기
3. **클라이언트 진행률 가시성 0** → 운영자 오해
4. **중복 클릭 차단 미비** → 다중 INSERT 사고

---

## 2. 작업 분해 (Phase 1, Day 1)

### Task 1 — 같은 product 그룹핑 (속도)
**파일**: `app/api/orders/bulk/route.ts` + `lib/services/stock/reservation.ts`

**의도**: 같은 productId 의 발주를 모아 reserveStock 1번 호출. row lock 경합 16→1.

**구현 방향**:
```ts
// bulk/route.ts 에서 발주 생성 루프 끝낸 후
const reserveMap = new Map<string, number>();  // productId → totalQty
for (const createdOrder of createdOrders) {
  for (const item of createdOrder.items) {
    reserveMap.set(item.productId, (reserveMap.get(item.productId) ?? 0) + item.quantity);
  }
}

// 새 함수 reserveStockBulk(reserveMap) 호출 — 1번에 처리
await reserveStockBulk(reserveMap, { orderIds: createdOrders.map(o => o.id) });
```

**reservation.ts 신규 함수**:
```ts
export async function reserveStockBulk(
  productQtyMap: Map<string, number>,
  options: { orderIds: string[] }
): Promise<{ success: boolean; failed: Array<{ productId: string; reason: string }> }> {
  // 1. ONEWMS 실시간 재고 일괄 조회 (Promise.allSettled)
  // 2. 한 트랜잭션 안에서 모든 product 의 reservedStock 동시 update
  // 3. atomic 검사: UPDATE WHERE totalStock - reservedStock >= qty
  // 4. 실패 product 만 반환
}
```

**예상 시간**: 1.5h

---

### Task 2 — ONEWMS fetch AbortController (속도/보험)
**파일**: `lib/onewms/client.ts`

**의도**: 외부 API hang 시 10초 후 강제 종료. 한 번 hang 이 전체 발주 흐름 막는 거 차단.

**구현**:
```ts
// client.ts 의 request() 와 requestRaw() 둘 다 변경
private async request<T>(...) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);  // 10초

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      signal: controller.signal,  // ← 추가
    });
    // ... 기존 처리
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**부작용 확인**: stockSync cron, 발주 sync 등 모든 ONEWMS 호출에 10초 timeout 적용됨. 정상 응답은 1초 이내라 영향 0. 단 stockSync 의 batch 호출 (수백 건) 은 별도 timeout 검토 필요 (또는 그건 30초로 별도 지정).

**예상 시간**: 0.5h

---

### Task 3 — 트랜잭션 격리 ReadCommitted + Atomic Update (속도)
**파일**: `lib/services/stock/reservation.ts`

**의도**: Serializable conflict (P2034) 폭발 제거. 그러나 race condition (overselling) 막아야 함.

**구현 — atomic update 패턴**:
```ts
await prisma.$transaction(async (tx) => {
  // 기존: SELECT then UPDATE → race condition 가능
  // 신규: 조건부 UPDATE → atomic
  const updated = await tx.product.updateMany({
    where: {
      id: productId,
      totalStock: { gte: prisma.raw('reservedStock + ' + qty) },  // 가용 재고 ≥ 요청
    },
    data: { reservedStock: { increment: qty } },
  });

  if (updated.count === 0) {
    throw new Error('재고 부족');
  }
  // 그 다음 StockReservation create
}, {
  isolationLevel: "ReadCommitted",  // ← Serializable 에서 변경
  timeout: 15000,
});
```

**검증 항목**:
- Prisma 가 `gte` 안에서 다른 컬럼 참조를 지원하는지 (raw SQL 또는 `$queryRaw` 필요할 수 있음)
- 동시 호출 시 락 동작 확인 (각 row 단위 lock)

**예상 시간**: 1.5h

---

### Task 4 — Idempotency Key (중복 방어, 서버측)
**파일**: `prisma/schema.prisma` + `app/api/orders/bulk/route.ts`

**Prisma 모델 신규**:
```prisma
model IdempotencyKey {
  key        String   @id
  endpoint   String   // "POST /api/orders/bulk"
  userId     String
  response   Json?    // 캐시된 응답 (success 시)
  status     String   @default("processing")  // processing | completed | failed
  createdAt  DateTime @default(now())
  expiresAt  DateTime  // createdAt + 30s

  @@index([expiresAt])
}
```

**API 흐름**:
```ts
const idempotencyKey = req.headers.get("X-Idempotency-Key");
if (!idempotencyKey) {
  return errors.badRequest("Idempotency-Key header 필수");
}

const existing = await prisma.idempotencyKey.findUnique({
  where: { key: idempotencyKey },
});

if (existing) {
  if (existing.status === "processing") {
    return errors.conflict("이미 처리 중인 요청입니다");
  }
  if (existing.status === "completed") {
    return ok(existing.response);  // 캐시된 응답 반환
  }
}

await prisma.idempotencyKey.create({
  data: {
    key: idempotencyKey,
    endpoint: "POST /api/orders/bulk",
    userId: user.userId,
    expiresAt: new Date(Date.now() + 30000),
  },
});

// ... 기존 발주 처리

// 완료 후 응답 캐싱
await prisma.idempotencyKey.update({
  where: { key: idempotencyKey },
  data: { status: "completed", response: { created, totalItems, message } },
});
```

**클라이언트 변경**: 매 업로드마다 UUID v4 생성 + `X-Idempotency-Key` 헤더에 담아 전송.

**Cleanup cron**: `IdempotencyKey` 의 `expiresAt < now()` 인 row 매일 새벽 삭제 (별도 cron 추가 또는 기존 cron 에 끼움).

**예상 시간**: 1h

---

### Task 5 — 클라이언트 sessionStorage 가드 (중복 방어, 보조)
**파일**: `app/(main)/orders/upload/page.tsx`

**구현**:
```ts
const handleUpload = async () => {
  if (!file || loading) return;

  // 1차 가드: 동일 파일 30초 내 재제출 차단
  const submitKey = `bulk-upload-${file.name}-${file.size}-${file.lastModified}`;
  if (sessionStorage.getItem(submitKey)) {
    toast({
      title: "이미 처리 중인 업로드가 있습니다",
      description: "30초 후에 다시 시도해주세요. 페이지 새로고침/재클릭 금지.",
    });
    return;
  }
  sessionStorage.setItem(submitKey, Date.now().toString());
  setTimeout(() => sessionStorage.removeItem(submitKey), 30000);

  // 2차 가드: Idempotency-Key 생성
  const idempotencyKey = crypto.randomUUID();

  setLoading(true);
  // ... 기존 fetch, 단 headers 에 'X-Idempotency-Key' 추가
};
```

**예상 시간**: 15m

---

### Task 6 — UploadJob 테이블 + 진행률 폴링 (가시성)
**Prisma 모델 신규**:
```prisma
model UploadJob {
  id            String   @id @default(cuid())
  userId        String
  endpoint      String   // "POST /api/orders/bulk"
  totalItems    Int
  processedItems Int     @default(0)
  status        String   @default("processing")  // processing | completed | failed
  result        Json?    // completed 시 응답
  errorMessage  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId, createdAt])
}
```

**API 변경**:
```ts
// POST /api/orders/bulk
// 1. UploadJob create (totalItems = items.length, processedItems = 0)
// 2. 발주 생성 루프 안에서 processedItems update (매 발주마다)
// 3. 완료 시 UploadJob.status = "completed", result 저장
```

**신규 엔드포인트**:
```ts
// GET /api/orders/bulk/progress/[jobId]
// 응답: { processedItems, totalItems, status, errorMessage?, result? }
```

**클라이언트 변경**:
```tsx
const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);

const handleUpload = async () => {
  // ... 기존
  const res = await fetch("/api/orders/bulk", {...});

  if (res.status === 202) {
    // 비동기 처리 시작됨, jobId 받음
    const { jobId } = await res.json();
    pollProgress(jobId);
  } else {
    // 동기 처리 완료
    ...
  }
};

const pollProgress = async (jobId: string) => {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/orders/bulk/progress/${jobId}`);
    const data = await res.json();
    setProgress({ processed: data.processedItems, total: data.totalItems });
    if (data.status !== "processing") {
      clearInterval(interval);
      // 완료 처리
    }
  }, 1000);
};
```

⚠️ **법적 우려로 비동기화 제외 결정** → 발주 INSERT 자체는 동기 처리 유지. UploadJob 은 **모니터링용**으로만 사용 (진행률 표시 + 사후 추적). 즉 발주 생성 루프 안에서 UploadJob 만 매 발주마다 update.

**대신**: 클라이언트는 fetch 응답을 기다리는 동안 별도 GET 으로 진행률 폴링 가능. 이는 단일 fetch 의 long-running 응답 + 진행률 폴링을 병행하는 패턴.

→ 폴링은 발주 처리 진행 중에 진행률만 보여주고, 최종 응답은 원래 fetch 가 받음.

**예상 시간**: 1.5h

---

## 3. 예상 효과

| 지표 | 현재 | Phase 1 적용 후 |
|---|---|---|
| 18건 응답 시간 | 192초 | **15~30초** |
| 운영자 체감 | "고장난 거 같음" | "진행 중 보이고 곧 끝남" |
| 중복 발주 | 발생 가능 | 0건 |
| ONEWMS hang | 무한 대기 | 10초 후 차단 |

---

## 4. 검증 절차

### 자동 검증
- `pnpm tsc --noEmit && pnpm lint && pnpm build` 모두 PASS
- Prisma migration 정상 적용 (UploadJob, IdempotencyKey)

### 운영 시뮬레이션
- 같은 엑셀 (테스트_최종1.xlsx 18건) 업로드 → 응답 시간 측정
- 같은 파일 다시 업로드 (30초 내) → 409 또는 cached 응답 확인
- ONEWMS API 일시 차단 (테스트 환경) → 10초 후 명확한 에러
- 진행률 폴링 시 1/18, 2/18, ... 표시 확인

---

## 5. 롤백 가이드
- 각 Task 별 단일 커밋
- 운영 영향 큰 Task 3 (격리 수준) 은 별도 PR + 검증 후 머지
- 문제 시 revert 가능

---

## 6. Phase 2 (나중에 결정)
- 발주 비동기화 (큐 도입) — 단, **법적 우려 해소 후**. ONEWMS 재고 사전 확인 → 즉시 답변 → 백그라운드 처리 패턴
- 진행률 SSE 전환 (폴링 → push)
- /admin/upload-jobs 운영 모니터링 대시보드
