import { prisma } from "@/lib/db/prisma";
import { logger, sanitizeError } from "@/lib/logger";

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitOptions {
  max?: number;
  windowMs?: number;
  /** true면 DB 장애 시 요청 차단 (로그인 등 보안 critical 경로용) */
  failClosed?: boolean;
}

/**
 * DB 기반 분산 Rate Limiting
 *
 * Serverless 환경(Vercel)에서 인스턴스 간 공유 가능.
 * Neon HTTP adapter는 interactive transaction 미지원이므로
 * 원자적 upsert + 후속 만료 체크로 구현 (upsert 자체는 DB-level atomic).
 */
export async function isRateLimitedDb(
  key: string,
  options?: RateLimitOptions,
): Promise<boolean> {
  const maxRequests = options?.max ?? DEFAULT_MAX_REQUESTS;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const failClosed = options?.failClosed ?? false;

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    // 원자적 upsert: 카운트 증가 (DB-level atomic)
    const entry = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: { increment: 1 } },
    });

    // 윈도우 만료 → 리셋
    if (entry.windowStart < windowStart) {
      await prisma.rateLimit.update({
        where: { key },
        data: { count: 1, windowStart: now },
      });
      return false;
    }

    return entry.count > maxRequests;
  } catch (err) {
    logger.error("rate_limit_db_error", { key, error: sanitizeError(err) });
    return failClosed;
  }
}

/**
 * 만료된 Rate Limit 레코드 정리
 * 주기적 호출 또는 API 요청 시 확률적 실행 권장.
 */
export async function cleanupExpiredRateLimits(windowMs?: number): Promise<number> {
  const cutoff = new Date(Date.now() - (windowMs ?? DEFAULT_WINDOW_MS));
  try {
    const { count } = await prisma.rateLimit.deleteMany({
      where: { windowStart: { lt: cutoff } },
    });
    if (count > 0) {
      logger.info("rate_limit_cleanup", { deletedCount: count });
    }
    return count;
  } catch (err) {
    logger.error("rate_limit_cleanup_error", { error: sanitizeError(err) });
    return 0;
  }
}
