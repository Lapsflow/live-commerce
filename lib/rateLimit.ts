/**
 * Rate Limiting 구현
 *
 * Upstash Redis 기반 Rate Limiter
 * 용도별 다른 제한 정책 적용
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Redis 클라이언트 (이미 구현된 것 재사용)
import { redis } from "./cache/redis";

/**
 * 로그인 시도 제한
 * - 5회 시도/5분
 * - IP 기반 제한
 */
export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "5 m"),
  analytics: true,
  prefix: "ratelimit:login",
});

/**
 * API 요청 제한 (일반)
 * - 100회/분
 * - 사용자 ID 기반
 */
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "ratelimit:api",
});

/**
 * 샘플 장바구니 제한
 * - 20회/분 (남용 방지)
 * - 사용자 ID 기반
 */
export const cartRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "ratelimit:cart",
});

/**
 * AI 분석 요청 제한
 * - 10회/시간 (비용 관리)
 * - 사용자 ID 기반
 */
export const aiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  analytics: true,
  prefix: "ratelimit:ai",
});

/**
 * 시세 조회 제한
 * - 30회/시간 (외부 API 보호)
 * - 사용자 ID 기반
 */
export const pricingRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  analytics: true,
  prefix: "ratelimit:pricing",
});

/**
 * Rate Limit 헬퍼 함수
 *
 * @param identifier - IP 주소 또는 사용자 ID
 * @param limiter - 사용할 rate limiter
 * @returns { success: boolean, limit: number, remaining: number, reset: Date }
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
}> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  return {
    success,
    limit,
    remaining,
    reset: new Date(reset),
  };
}

/**
 * IP 주소 추출 헬퍼
 *
 * Vercel 배포 환경에서 실제 클라이언트 IP 추출
 */
export function getClientIp(headers: Headers): string {
  // Vercel에서 제공하는 실제 IP
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // Fallback
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // 로컬 개발 환경
  return "127.0.0.1";
}

/**
 * Rate Limit 응답 헬퍼
 *
 * Rate limit 초과 시 표준 에러 응답 생성
 */
export function rateLimitExceededResponse(reset: Date) {
  const retryAfter = Math.ceil((reset.getTime() - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
        retryAfter: retryAfter,
        retryAt: reset.toISOString(),
      },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Reset": reset.toISOString(),
      },
    }
  );
}
