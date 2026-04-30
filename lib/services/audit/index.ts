import { prisma } from "@/lib/db/prisma"
import type { Prisma } from "@/lib/generated/prisma/client"
import type { AuditLogParams } from "./types"
import { sanitize } from "./sanitize"

/**
 * 변경 전/후 diff 계산
 * 변경된 필드만 { field: { from, to } } 형태로 반환
 */
function calculateDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): Record<string, { from: unknown; to: unknown }> | null {
  if (!before || !after) return null

  const diff: Record<string, { from: unknown; to: unknown }> = {}

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    const oldVal = before[key]
    const newVal = after[key]

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { from: oldVal ?? null, to: newVal ?? null }
    }
  }

  return Object.keys(diff).length > 0 ? diff : null
}

/**
 * Request에서 IP, User-Agent 추출
 */
function getRequestContext(request?: Request | null): {
  ipAddress: string | null
  userAgent: string | null
} {
  if (!request) return { ipAddress: null, userAgent: null }

  const headers = request.headers
  const ipAddress =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null
  const userAgent = headers.get("user-agent") || null

  return { ipAddress, userAgent }
}

/**
 * AuditLog 기록 (fire-and-forget)
 * 본 작업을 절대 막지 않도록 비동기 처리
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const sanitizedBefore = sanitize(params.before)
    const sanitizedAfter = sanitize(params.after)
    const diff = calculateDiff(sanitizedBefore, sanitizedAfter)
    const { ipAddress, userAgent } = getRequestContext(params.request)

    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        userRole: params.userRole ?? null,
        userName: params.userName ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        entityName: params.entityName ?? null,
        before: (sanitizedBefore ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (sanitizedAfter ?? undefined) as Prisma.InputJsonValue | undefined,
        diff: (diff ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress,
        userAgent,
        description: params.description ?? null,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (error) {
    // AuditLog 실패가 본 작업을 막지 않도록 로그만 출력
    console.error("[AuditLog] Failed to write audit log:", error)
  }
}

export { sanitize } from "./sanitize"
export type { AuditLogParams } from "./types"
