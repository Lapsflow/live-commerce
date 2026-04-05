/**
 * Prisma Client — Neon Serverless Adapter + Retry
 *
 * Serverless 환경(Vercel)에서 connection pooling 최적화.
 * Lazy init: 첫 DB 호출 시점까지 연결 생성 지연 (cold start 개선).
 * Dev 환경에서는 globalThis 캐시로 hot-reload 시 연결 누수 방지.
 * Transient 오류(Neon cold start, 연결 끊김) 시 최대 2회 자동 재시도.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { getEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** Neon/Prisma transient 오류 판별 — 재시도 대상 */
function isRetryableError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes("p1001") || // Can't reach database server
    msg.includes("p1002") || // Database server timed out
    msg.includes("p1008") || // Operations timed out
    msg.includes("p1017") || // Server closed the connection
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("fetch failed") ||
    msg.includes("socket hang up")
  );
}

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getEnv();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
  const baseClient = new PrismaClient({
    adapter,
  } as unknown as ConstructorParameters<typeof PrismaClient>[0]);

  // Retry middleware: transient 오류 시 최대 2회 재시도 (100ms, 200ms backoff)
  const extended = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({
          args,
          query,
        }: {
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          const MAX_RETRIES = 2;
          let lastError: unknown;
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              return await query(args);
            } catch (error) {
              lastError = error;
              if (attempt < MAX_RETRIES && isRetryableError(error)) {
                await new Promise((r) =>
                  setTimeout(r, 100 * (attempt + 1))
                );
                continue;
              }
              throw error;
            }
          }
          throw lastError;
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Lazy-initialized Prisma client (defers connection until first use) */
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getPrisma() as any)[prop];
  },
});

export { isRetryableError };
