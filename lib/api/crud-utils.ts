import { errors } from "./response";
import { logger, sanitizeError } from "@/lib/logger";

/** 쓰기 요청에서 항상 차단되는 필드 (보안) */
export const BLOCKED_WRITE_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "passwordHash",
]);

/** 쓰기 body에서 차단 필드 제거 */
export function stripBlockedFields(body: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...body };
  for (const field of BLOCKED_WRITE_FIELDS) {
    delete cleaned[field];
  }
  return cleaned;
}

const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

/** URL 경로에서 마지막 segment 추출 (query string 안전, ID 형식 검증) */
export function extractIdFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const id = pathname.split("/").pop();
  if (!id || !SAFE_ID_RE.test(id)) {
    throw new Error("Invalid ID format");
  }
  return id;
}

/** 응답 객체에서 필드 제거 */
export function filterFields(record: Record<string, unknown>, excludeFields: string[]) {
  const filtered = { ...record };
  for (const f of excludeFields) {
    delete filtered[f];
  }
  return filtered;
}

/** 통합 에러 핸들러: Prisma 에러 코드별 분기 처리 */
export function handlePrismaError(err: unknown, model: string) {
  // Prisma error codes
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "P2025") return errors.notFound(model);
    if (code === "P2002") return errors.conflict("중복된 값이 존재합니다");
    if (code === "P2003") return errors.badRequest("참조 무결성 위반");
    if (code === "P2024") {
      logger.error("Prisma connection timeout", { model });
      return errors.internal("데이터베이스 연결 시간 초과");
    }
    if (code === "P2034") {
      logger.error("Prisma transaction conflict", { model });
      return errors.conflict("트랜잭션 충돌 — 다시 시도해 주세요");
    }
    if (code === "P2028") {
      logger.error("Prisma transaction API error", { model });
      return errors.internal("트랜잭션 처리 실패");
    }
  }
  logger.error("Prisma error", { model, error: sanitizeError(err) });
  return errors.internal();
}
