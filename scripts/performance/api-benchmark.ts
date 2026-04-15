/**
 * API Performance Benchmark Script
 *
 * 주요 API 엔드포인트의 응답 시간을 측정합니다.
 * 목표: p95 < 2000ms, p50 < 500ms
 */

interface BenchmarkResult {
  endpoint: string;
  method: string;
  samples: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

async function measureEndpoint(
  url: string,
  method: string = 'GET',
  body?: any,
  headers: Record<string, string> = {},
  samples: number = 10
): Promise<BenchmarkResult> {
  const times: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = performance.now();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      await response.json();
      const end = performance.now();
      times.push(end - start);
    } catch (error) {
      console.error(`Error measuring ${url}:`, error);
      times.push(Infinity);
    }

    // 100ms 간격으로 요청
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  times.sort((a, b) => a - b);

  const sum = times.reduce((acc, t) => acc + t, 0);
  const avg = sum / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  return {
    endpoint: url,
    method,
    samples,
    min: times[0],
    max: times[times.length - 1],
    avg,
    p50,
    p95,
    p99,
  };
}

async function runBenchmarks() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // 테스트용 인증 토큰 (환경변수에서 가져오기)
  const authToken = process.env.TEST_AUTH_TOKEN || '';

  console.log('🚀 API Performance Benchmark');
  console.log('─'.repeat(80));
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Samples per endpoint: 10`);
  console.log('─'.repeat(80));
  console.log('');

  const results: BenchmarkResult[] = [];

  // 1. Products API
  console.log('📦 Testing Products API...');
  results.push(
    await measureEndpoint(
      `${baseUrl}/api/products`,
      'GET',
      undefined,
      { Authorization: `Bearer ${authToken}` }
    )
  );

  // 2. Centers API
  console.log('🏢 Testing Centers API...');
  results.push(
    await measureEndpoint(
      `${baseUrl}/api/centers`,
      'GET',
      undefined,
      { Authorization: `Bearer ${authToken}` }
    )
  );

  // 3. Broadcasts API
  console.log('📺 Testing Broadcasts API...');
  results.push(
    await measureEndpoint(
      `${baseUrl}/api/broadcasts`,
      'GET',
      undefined,
      { Authorization: `Bearer ${authToken}` }
    )
  );

  // 4. Proposals Cart API
  console.log('🛒 Testing Proposals Cart API...');
  results.push(
    await measureEndpoint(
      `${baseUrl}/api/proposals/cart`,
      'GET',
      undefined,
      { Authorization: `Bearer ${authToken}` }
    )
  );

  // 5. ONEWMS Stats API
  console.log('📊 Testing ONEWMS Stats API...');
  results.push(
    await measureEndpoint(
      `${baseUrl}/api/onewms/stats`,
      'GET',
      undefined,
      { Authorization: `Bearer ${authToken}` }
    )
  );

  console.log('');
  console.log('📊 Results');
  console.log('─'.repeat(80));
  console.log(
    'Endpoint'.padEnd(40),
    'Avg'.padEnd(10),
    'p50'.padEnd(10),
    'p95'.padEnd(10),
    'Status'
  );
  console.log('─'.repeat(80));

  for (const result of results) {
    const status =
      result.p95 < 2000 && result.p50 < 500
        ? '✅ PASS'
        : result.p95 < 3000
        ? '⚠️  WARN'
        : '❌ FAIL';

    const endpoint = result.endpoint.replace(baseUrl, '');

    console.log(
      endpoint.padEnd(40),
      `${result.avg.toFixed(0)}ms`.padEnd(10),
      `${result.p50.toFixed(0)}ms`.padEnd(10),
      `${result.p95.toFixed(0)}ms`.padEnd(10),
      status
    );
  }

  console.log('─'.repeat(80));
  console.log('');

  // Summary
  const passed = results.filter((r) => r.p95 < 2000 && r.p50 < 500).length;
  const warned = results.filter((r) => r.p95 >= 2000 && r.p95 < 3000).length;
  const failed = results.filter((r) => r.p95 >= 3000).length;

  console.log('📈 Summary');
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`⚠️  Warned: ${warned}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log('');

  if (failed > 0) {
    console.log('💡 Recommendations:');
    console.log('- Review database indexes');
    console.log('- Add caching for frequently accessed data');
    console.log('- Optimize query patterns (avoid N+1)');
    console.log('- Consider pagination for large datasets');
  }
}

// Run benchmarks
runBenchmarks().catch(console.error);
