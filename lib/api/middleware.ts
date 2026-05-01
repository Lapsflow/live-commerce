import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger, securityLogger, sanitizeError } from "@/lib/logger";
import { logAudit } from "@/lib/services/audit";

export type Role = "MASTER" | "SUB_MASTER" | "SELLER";

const VALID_ROLES: readonly string[] = ["MASTER", "SUB_MASTER", "SELLER"];

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: Role;
  centerId?: string;
}

type NextHandler = (req: NextRequest, context?: any) => Promise<NextResponse>;
type AuthHandler = (req: NextRequest, user: AuthUser, context?: any) => Promise<NextResponse>;

function toAuthUser(user: Record<string, unknown>): AuthUser | null {
  const { userId, name, email, role, centerId } = user;
  if (typeof userId !== "string" || typeof name !== "string" || typeof email !== "string") return null;
  if (typeof role !== "string" || !VALID_ROLES.includes(role)) return null;
  return {
    userId,
    name,
    email,
    role: role as Role,
    centerId: typeof centerId === "string" ? centerId : undefined,
  };
}

/** CSRF Origin 검증 (mutating requests만) */
function verifyCsrf(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return true;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** JWT 검증 + CSRF 검증 + 사용자 정보 주입 */
export function withAuth(handler: AuthHandler): NextHandler {
  return async (req: NextRequest, context?: any) => {
    // CSRF 검증
    if (!verifyCsrf(req)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "CSRF 검증 실패" } },
        { status: 403 }
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "로그인 필요" } },
        { status: 401 }
      );
    }
    const authUser = toAuthUser(session.user as unknown as Record<string, unknown>);
    if (!authUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "세션 정보 불완전" } },
        { status: 401 }
      );
    }
    return handler(req, authUser, context);
  };
}

/** 역할 검증 */
export function withRole(
  allowedRoles: Role[],
  handler: AuthHandler
): NextHandler {
  return withAuth(async (req, user, context) => {
    if (!allowedRoles.includes(user.role)) {
      securityLogger.authzFailed({
        userId: user.userId,
        role: user.role,
        requiredRoles: allowedRoles,
        path: new URL(req.url).pathname,
      });
      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "PERMISSION_DENIED",
        entityType: "API",
        description: `권한 거부: ${new URL(req.url).pathname} (필요: ${allowedRoles.join(",")}, 보유: ${user.role})`,
        request: req,
      });
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "권한 없음" } },
        { status: 403 }
      );
    }
    return handler(req, user, context);
  });
}

/** 에러 핸들러 래퍼 — withRole/withAuth 감싸서 사용 */
export function withErrorHandler(handler: NextHandler): NextHandler {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (err) {
      const requestId = req.headers.get("x-request-id") ?? "unknown";
      logger.error("API error", { requestId, method: req.method, url: req.url, error: sanitizeError(err) });
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
        { status: 500 }
      );
    }
  };
}

export type { NextHandler };
