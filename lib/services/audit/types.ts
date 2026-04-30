import type { AuditAction, Role } from "@/lib/generated/prisma/client"

export interface AuditLogParams {
  // 누가
  userId?: string | null
  userRole?: Role | null
  userName?: string | null

  // 무엇을
  action: AuditAction
  entityType: string // "User" | "Product" | "Order" | "Broadcast" | "Center"
  entityId?: string | null
  entityName?: string | null

  // 변경 내용
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null

  // 설명
  description?: string

  // 메타데이터
  metadata?: Record<string, unknown> | null

  // HTTP 요청 (IP, User-Agent 추출용)
  request?: Request | null
}
