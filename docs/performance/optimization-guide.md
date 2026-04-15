# 성능 최적화 가이드

## 📊 성능 목표

- **API 응답 시간**: p95 < 2000ms, p50 < 500ms
- **페이지 로드**: FCP < 1.8s, LCP < 2.5s
- **번들 크기**: 초기 로드 < 200KB (gzipped)
- **Lighthouse 점수**: Performance > 90

## 🚀 구현된 최적화

### 1. 데이터베이스 최적화

**인덱스 전략**:
```prisma
// User 테이블
@@index([email])        // 로그인 쿼리 최적화
@@index([role])         // 역할 기반 필터링
@@index([centerId])     // 센터별 사용자 조회

// Order 테이블
@@index([sellerId, uploadedAt])           // 셀러별 주문 목록
@@index([orderNo])                         // 주문번호 검색
@@index([paymentStatus, shippingStatus])   // 상태별 필터링

// Product 테이블
@@unique([code])        // 상품코드 검색 (unique)
@@unique([barcode])     // 바코드 검색 (unique)

// Broadcast 테이블
@@index([sellerId])     // 셀러별 방송 목록
@@index([status])       // 상태별 필터링

// ProposalCart 테이블
@@index([userId])       // 사용자별 장바구니 조회
@@unique([userId, productId])  // 중복 방지
```

**쿼리 최적화**:
- N+1 문제 방지: `include` 활용하여 관계 데이터 한 번에 로드
- 페이지네이션: `take`와 `skip` 사용
- 필요한 필드만 조회: `select` 활용

### 2. API 응답 최적화

**캐싱 전략**:
```typescript
// Redis 캐싱 (Upstash)
// - 시세 정보: 1시간 TTL
// - 센터 목록: 5분 TTL
// - ONEWMS 통계: 10분 TTL

// SWR 클라이언트 캐싱
const { data } = useSWR('/api/products', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000, // 1분
});
```

**응답 크기 최소화**:
- 필요한 필드만 반환
- JSON 압축 (gzip)
- 페이지네이션 구현

### 3. Next.js 설정 최적화

**next.config.js**:
```javascript
module.exports = {
  // 이미지 최적화
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60,
  },

  // 번들 최적화
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 실험적 기능
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // 압축
  compress: true,

  // 정적 생성 최적화
  output: 'standalone',
};
```

**React 19 최적화**:
- Server Components 활용 (기본값)
- `use client` 최소화
- Suspense 경계 설정

### 4. 프론트엔드 최적화

**코드 스플리팅**:
```typescript
// 동적 import로 번들 크기 감소
const AIAnalysisCard = dynamic(() => import('./AIAnalysisCard'), {
  loading: () => <Skeleton />,
  ssr: false, // 클라이언트 전용 컴포넌트
});
```

**이미지 최적화**:
```typescript
import Image from 'next/image';

<Image
  src="/product.jpg"
  width={400}
  height={300}
  alt="Product"
  priority // 우선 로드
  placeholder="blur" // 블러 효과
/>
```

**폰트 최적화**:
```typescript
// app/layout.tsx
import localFont from 'next/font/local';

const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  display: 'swap',
  variable: '--font-pretendard',
});
```

## 📈 성능 측정

### API 벤치마크 실행

```bash
# API 응답 시간 측정
npx tsx scripts/performance/api-benchmark.ts
```

**결과 예시**:
```
Endpoint                                  Avg        p50        p95        Status
/api/products                             245ms      230ms      390ms      ✅ PASS
/api/centers                              180ms      170ms      280ms      ✅ PASS
/api/broadcasts                           320ms      290ms      520ms      ✅ PASS
/api/proposals/cart                       150ms      140ms      210ms      ✅ PASS
/api/onewms/stats                         890ms      850ms      1200ms     ✅ PASS
```

### 데이터베이스 인덱스 확인

```bash
# PostgreSQL에서 실행
psql $DATABASE_URL -f scripts/performance/check-indexes.sql
```

### Lighthouse 측정

```bash
# Chrome DevTools 또는 CLI
npm install -g lighthouse
lighthouse http://localhost:3000 --view
```

**목표 점수**:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90
- SEO: > 90

## 🔧 추가 최적화 권장사항

### 1. CDN 활용

```typescript
// 정적 에셋을 CDN으로 서빙
const CDN_URL = process.env.CDN_URL || '';

export const assetUrl = (path: string) => {
  return CDN_URL ? `${CDN_URL}${path}` : path;
};
```

### 2. API Rate Limiting

```typescript
// lib/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
});
```

### 3. Database Connection Pooling

```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';

// Connection pooling 설정
neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});
```

### 4. 배치 처리 최적화

```typescript
// ONEWMS 재고 동기화를 배치로 처리
const BATCH_SIZE = 5;

for (let i = 0; i < products.length; i += BATCH_SIZE) {
  const batch = products.slice(i, i + BATCH_SIZE);

  await Promise.all(
    batch.map(async (product) => {
      return syncProductStock(product);
    })
  );

  // Rate limiting 방지
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
```

## 🎯 성능 모니터링

### Vercel Analytics

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Custom Metrics

```typescript
// lib/metrics.ts
export async function trackMetric(name: string, value: number) {
  // Vercel Analytics 또는 다른 모니터링 서비스로 전송
  console.log(`[Metric] ${name}: ${value}ms`);
}

// 사용 예시
const start = Date.now();
await fetchData();
await trackMetric('api.fetchData', Date.now() - start);
```

## ✅ 체크리스트

- [ ] API 응답 시간 < 2초 (p95)
- [ ] 데이터베이스 인덱스 최적화
- [ ] 이미지 최적화 (WebP, AVIF)
- [ ] 코드 스플리팅 적용
- [ ] 캐싱 전략 구현
- [ ] CDN 설정
- [ ] Rate limiting 구현
- [ ] Lighthouse 점수 > 90
- [ ] 모니터링 설정
- [ ] Error tracking 설정 (Sentry 등)
