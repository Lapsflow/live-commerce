/**
 * POST /api/ai/analyze
 * Analyze product with AI (pricing + sales strategy)
 * Rate limit: 10 requests/hour per user
 * Phase 2: withRole() middleware applied
 * Phase 3: Zod validation added
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { analyzeProduct } from '@/lib/services/ai/analysis';
import { getCounter, incrementCounter } from '@/lib/cache/redis';
import { withRole, type AuthUser } from '@/lib/api/middleware';
import { z } from 'zod';

const RATE_LIMIT_PER_HOUR = 10;
const RATE_LIMIT_WINDOW = 60 * 60; // 1 hour in seconds

// Phase 3: Zod validation schema
const aiAnalyzeSchema = z.object({
  barcode: z.string().min(1, "바코드가 필요합니다"),
  skipCache: z.boolean().optional(),
});

export const POST = withRole(["ADMIN", "SELLER"], async (req: NextRequest, user: AuthUser) => {
  try {
    // Rate limiting check
    const userId = user.userId;
    const rateLimitKey = `ai:ratelimit:${userId}:${getHourKey()}`;
    const requestCount = await getCounter(rateLimitKey);

    if (requestCount >= RATE_LIMIT_PER_HOUR) {
      return errors.tooManyRequests(
        `시간당 ${RATE_LIMIT_PER_HOUR}회 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.`
      );
    }

    const body = await req.json();

    // Phase 3: Validate input with Zod
    const validationResult = aiAnalyzeSchema.safeParse(body);
    if (!validationResult.success) {
      return errors.badRequest(validationResult.error.issues[0].message);
    }

    const { barcode, skipCache } = validationResult.data;

    // Increment rate limit counter
    await incrementCounter(rateLimitKey, RATE_LIMIT_WINDOW);

    // Analyze product
    const analysis = await analyzeProduct(barcode, {
      skipCache: skipCache === true,
      storeInDb: true,
    });

    // Add rate limit info to response
    const remaining = RATE_LIMIT_PER_HOUR - requestCount - 1;
    const resetAt = getNextHourReset();

    const response = ok({
      ...analysis,
      rateLimit: {
        limit: RATE_LIMIT_PER_HOUR,
        remaining: Math.max(0, remaining),
        resetAt,
      },
    });

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_PER_HOUR.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, remaining).toString());
    response.headers.set('X-RateLimit-Reset', resetAt.toISOString());

    return response;
  } catch (error) {
    console.error('Failed to analyze product:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('찾을 수 없습니다')) {
        return errors.notFound(error.message);
      }
      if (error.message.includes('rate limit') || error.message.includes('제한')) {
        return errors.tooManyRequests(error.message);
      }
      return errors.internal(error.message);
    }

    return errors.internal('AI 분석 중 오류가 발생했습니다');
  }
});

/**
 * Get current hour key for rate limiting
 */
function getHourKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
}

/**
 * Get next hour reset timestamp
 */
function getNextHourReset(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next;
}
