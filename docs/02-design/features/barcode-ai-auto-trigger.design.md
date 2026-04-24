# 바코드 AI 자동 분석 설계 문서

## 1. 개요

### 목적
pptx 스펙에 따라 바코드 스캔 즉시 AI 분석을 자동으로 실행하도록 수정

### 문제점
- **현재**: 사용자가 "AI 분석 시작" 버튼을 클릭해야 AI 분석 실행
- **pptx 요구**: 바코드를 찍으면 미리 입력해둔 프롬프트에 따라 자동으로 상품 경쟁력 분석

### 목표
- 바코드 스캔 완료 시 AI 분석 자동 실행
- "AI 분석 시작" 버튼 제거
- 분석 결과 기본 펼침 상태로 표시
- 사용자 경험 개선

---

## 2. 아키텍처 변경

### 현재 구조

```
바코드 스캔 → 상품 정보 표시 → [사용자가 "AI 분석 시작" 버튼 클릭] → AI 분석 실행 → 결과 표시
```

### 변경 후 구조

```
바코드 스캔 → 상품 정보 표시 + AI 분석 자동 실행 → 결과 표시
```

---

## 3. 파일별 수정 계획

### 3.1. Hook 변경: `app/(main)/inventory/barcode/hooks/useAIAnalysis.ts`

**현재 구현** (useMutation 사용):
```typescript
export function useAIAnalysis() {
  return useMutation({
    mutationFn: async ({ barcode, skipCache }: { barcode: string; skipCache?: boolean }) => {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, skipCache }),
      });
      const json = await response.json();
      return json.data;
    },
  });
}
```

**변경 후** (useQuery 사용):
```typescript
export function useAIAnalysis(barcode: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['ai-analysis', barcode],
    queryFn: async () => {
      if (!barcode) {
        throw new Error('바코드가 필요합니다');
      }

      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI 분석 실패');
      }

      const json = await response.json();
      return json.data;
    },
    enabled: !!barcode && enabled, // 바코드가 있고 enabled일 때만 자동 실행
    staleTime: 1000 * 60 * 60, // 1시간 캐싱 (rate limit 고려)
    retry: false, // rate limit 에러 시 재시도 하지 않음
  });
}
```

**변경 이유**:
- `useMutation`: 사용자 액션(버튼 클릭)에 의해 수동 트리거
- `useQuery`: 데이터 의존성에 따라 자동 실행
- 바코드가 변경되면 자동으로 AI 분석 실행

---

### 3.2. UI 컴포넌트 변경: `app/(main)/inventory/barcode/components/AIInsightsCard.tsx`

**현재 구현**:
```typescript
const AIInsightsCard = ({ barcode }: { barcode: string }) => {
  const [isExpanded, setIsExpanded] = useState(false); // ❌ 기본 접힘
  const mutation = useAIAnalysis(); // ❌ 수동 트리거

  const handleAnalyze = () => {
    mutation.mutate({ barcode }); // ❌ 버튼 클릭 시 실행
  };

  return (
    <Card>
      {!mutation.data && (
        <button onClick={handleAnalyze}> {/* ❌ 수동 버튼 */}
          AI 분석 시작
        </button>
      )}
      {mutation.data && <결과 표시>}
    </Card>
  );
};
```

**변경 후**:
```typescript
const AIInsightsCard = ({ barcode }: { barcode: string }) => {
  const [isExpanded, setIsExpanded] = useState(true); // ✅ 기본 펼침
  const { data, isLoading, error } = useAIAnalysis(barcode); // ✅ 자동 실행

  // ✅ 버튼 제거, 자동으로 분석 시작

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <CardTitle>AI 경쟁력 분석</CardTitle>
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI 분석 중...</span>
            </div>
          )}

          {error && (
            <div className="text-destructive">
              {error.message}
            </div>
          )}

          {data && <결과 표시 컴포넌트>}
        </CardContent>
      )}
    </Card>
  );
};
```

**변경 사항**:
1. ✅ "AI 분석 시작" 버튼 제거
2. ✅ `useState(true)`로 기본 펼침 상태
3. ✅ `useAIAnalysis(barcode)` 자동 실행
4. ✅ 로딩 상태 표시 추가
5. ✅ 에러 처리 개선

---

### 3.3. 부모 컴포넌트 변경: `app/(main)/inventory/barcode/components/BarcodeScannerContainer.tsx`

**확인 필요**: 바코드 스캔 완료 시 AIInsightsCard에 barcode를 전달하는 로직

**예상 구조**:
```typescript
const BarcodeScannerContainer = () => {
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const { data: product } = useProduct(scannedBarcode);

  return (
    <div>
      <BarcodeScanner onScan={setScannedBarcode} />

      {scannedBarcode && product && (
        <>
          <ProductInfoCard product={product} />
          <PriceComparisonCard barcode={scannedBarcode} />
          <AIInsightsCard barcode={scannedBarcode} /> {/* ✅ 자동 분석 시작 */}
        </>
      )}
    </div>
  );
};
```

---

## 4. API 변경 사항

### 4.1. Rate Limit 고려

**현재 Rate Limit**: 10회/시간

**문제점**:
- 자동 실행 시 rate limit 초과 가능성
- 사용자가 의도치 않게 여러 번 스캔 시 빠르게 한도 소진

**해결 방안**:

**Option 1: React Query 캐싱 활용** (권장)
```typescript
useQuery({
  queryKey: ['ai-analysis', barcode],
  queryFn: aiAnalysisFn,
  staleTime: 1000 * 60 * 60, // 1시간 캐싱
  cacheTime: 1000 * 60 * 60 * 24, // 24시간 보관
});
```
- 같은 바코드 재스캔 시 캐시된 결과 사용
- API 호출 최소화

**Option 2: Rate Limit 증가** (서버 측 변경)
```typescript
// app/api/ai/analyze/route.ts
const RATE_LIMIT_PER_HOUR = 30; // 10 → 30으로 증가
```

**Option 3: 디바운싱** (선택 사항)
```typescript
// 바코드 변경 후 500ms 대기 후 분석 실행
const debouncedBarcode = useDebounce(barcode, 500);
const { data } = useAIAnalysis(debouncedBarcode);
```

**권장 조합**: Option 1 (캐싱) + Option 2 (rate limit 증가)

---

## 5. 사용자 경험 개선

### 5.1. 로딩 상태 개선

**현재**: 버튼 클릭 후 로딩 표시

**변경 후**: 바코드 스캔 즉시 로딩 표시
```typescript
{isLoading && (
  <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>AI가 상품 경쟁력을 분석하고 있습니다...</span>
  </div>
)}
```

### 5.2. 에러 처리 개선

**Rate Limit 에러**:
```typescript
{error?.message.includes('rate limit') && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>분석 한도 초과</AlertTitle>
    <AlertDescription>
      시간당 {RATE_LIMIT}회 분석 제한을 초과했습니다.
      {resetAt && ` ${formatTime(resetAt)}에 다시 사용 가능합니다.`}
    </AlertDescription>
  </Alert>
)}
```

**일반 에러**:
```typescript
{error && !error.message.includes('rate limit') && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>분석 실패</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}
```

### 5.3. 재시도 기능 (선택 사항)

**캐시 무시 재분석**:
```typescript
const queryClient = useQueryClient();

const handleRefresh = () => {
  queryClient.invalidateQueries(['ai-analysis', barcode]);
};

return (
  <Button onClick={handleRefresh} variant="outline" size="sm">
    <RefreshCw className="h-4 w-4 mr-2" />
    재분석
  </Button>
);
```

---

## 6. 테스트 계획

### 6.1. 단위 테스트

**Hook 테스트**:
```typescript
// useAIAnalysis.test.ts
describe('useAIAnalysis', () => {
  it('바코드가 있으면 자동으로 분석 실행', async () => {
    const { result } = renderHook(() => useAIAnalysis('1234567890123'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });

  it('바코드가 없으면 실행하지 않음', () => {
    const { result } = renderHook(() => useAIAnalysis(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('enabled=false면 실행하지 않음', () => {
    const { result } = renderHook(() => useAIAnalysis('1234567890123', false));
    expect(result.current.isLoading).toBe(false);
  });
});
```

### 6.2. E2E 테스트

**Playwright 테스트**:
```typescript
// barcode-ai-auto-trigger.spec.ts
test('바코드 스캔 시 AI 분석 자동 실행', async ({ page }) => {
  // 1. 바코드 스캔 페이지 접속
  await page.goto('/inventory/barcode');

  // 2. 바코드 입력 (카메라 대신 수동 입력으로 테스트)
  await page.fill('[data-testid="barcode-input"]', '8809123456789');
  await page.click('[data-testid="scan-button"]');

  // 3. AI 분석 자동 시작 확인
  await expect(page.locator('text=AI가 상품 경쟁력을 분석하고 있습니다')).toBeVisible();

  // 4. 분석 완료 후 결과 표시 확인
  await expect(page.locator('[data-testid="ai-analysis-result"]')).toBeVisible({ timeout: 10000 });

  // 5. "AI 분석 시작" 버튼이 없음을 확인
  await expect(page.locator('button:has-text("AI 분석 시작")')).not.toBeVisible();

  // 6. 결과가 기본 펼침 상태인지 확인
  await expect(page.locator('[data-testid="ai-insights-content"]')).toBeVisible();
});

test('Rate limit 에러 처리', async ({ page }) => {
  // Rate limit 초과 상황 시뮬레이션
  // ...
  await expect(page.locator('text=분석 한도 초과')).toBeVisible();
});
```

### 6.3. 수동 테스트 체크리스트

- [ ] 바코드 스캔 시 자동으로 AI 분석 시작
- [ ] 로딩 상태 표시 확인
- [ ] 분석 결과가 기본 펼침 상태로 표시
- [ ] "AI 분석 시작" 버튼이 존재하지 않음
- [ ] 같은 바코드 재스캔 시 캐시된 결과 사용
- [ ] Rate limit 초과 시 적절한 에러 메시지 표시
- [ ] 재분석 버튼 동작 확인 (Option)

---

## 7. 마이그레이션 전략

### 7.1. 단계별 전환

**Phase 1: 캐싱 추가**
- React Query 캐싱 설정 추가
- 성능 테스트

**Phase 2: 자동 실행 구현**
- `useAIAnalysis` hook 변경
- `AIInsightsCard` 컴포넌트 수정

**Phase 3: UI 개선**
- 버튼 제거
- 기본 펼침 상태로 변경
- 로딩/에러 UI 개선

**Phase 4: 검증**
- E2E 테스트 실행
- 수동 테스트
- 사용자 피드백 수집

### 7.2. 롤백 계획

만약 문제가 발생하면:
1. `useAIAnalysis`를 원래 `useMutation` 방식으로 되돌림
2. "AI 분석 시작" 버튼 복원
3. `useState(false)`로 기본 접힌 상태로 변경

---

## 8. 성능 최적화

### 8.1. React Query 설정

```typescript
// app/(main)/inventory/barcode/providers/QueryProvider.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      cacheTime: 1000 * 60 * 30, // 30분
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### 8.2. 메모리 관리

```typescript
// 오래된 캐시 정리
useEffect(() => {
  const cleanup = () => {
    queryClient.clear(); // 페이지 언마운트 시 캐시 정리
  };

  return cleanup;
}, []);
```

---

## 9. 보안 고려사항

### 9.1. Rate Limit 우회 방지

- 서버 측 rate limit은 유지
- 클라이언트 캐싱은 보안이 아닌 성능 최적화 목적
- Redis 기반 rate limit은 여전히 작동

### 9.2. 에러 메시지 노출

- 상세한 에러 메시지는 개발 환경에서만 표시
- 프로덕션에서는 일반적인 메시지만 표시

---

## 10. 참고 문서

- [React Query 공식 문서](https://tanstack.com/query/latest)
- [useQuery vs useMutation](https://tanstack.com/query/latest/docs/react/guides/queries)
- [Rate Limiting Best Practices](https://www.ietf.org/archive/id/draft-ietf-httpapi-ratelimit-headers-07.html)

---

## 11. 구현 순서

1. ✅ 설계 문서 작성 (현재)
2. [ ] `useAIAnalysis.ts` hook 변경 (useMutation → useQuery)
3. [ ] `AIInsightsCard.tsx` 컴포넌트 수정 (버튼 제거, 기본 펼침)
4. [ ] Rate limit 증가 (10 → 30)
5. [ ] 로딩/에러 UI 개선
6. [ ] E2E 테스트 작성 및 실행
7. [ ] 수동 테스트 및 QA
8. [ ] Gap analysis 재실행 (목표: 100% 일치)
9. [ ] 배포

---

## 12. 예상 소요 시간

- Hook 변경: 1시간
- UI 컴포넌트 수정: 2시간
- 테스트 작성 및 실행: 2시간
- 검증 및 수정: 1시간

**총 예상 시간**: 6시간
