import { NextResponse } from "next/server";

/** 표준 성공 응답 (단건) */
export function ok<T>(data: T) {
  return NextResponse.json({ data });
}

/** 표준 생성 응답 (201 Created) */
export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

/** 표준 성공 응답 (페이지네이션) */
export function paginated<T>(
  data: T[],
  totalCount: number,
  pageSize: number,
  nextCursor?: string
) {
  return NextResponse.json(
    {
      data,
      totalCount,
      pageCount: totalCount >= 0 ? Math.ceil(totalCount / pageSize) : -1,
      ...(nextCursor && { nextCursor }),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=0, stale-while-revalidate=30",
      },
    }
  );
}

/** 표준 에러 응답 */
export function error(
  code: string,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  );
}

/** 공통 에러 헬퍼 */
export const errors = {
  unauthorized: () => error("UNAUTHORIZED", "로그인 필요", 401),
  forbidden: (message = "권한 없음") => error("FORBIDDEN", message, 403),
  notFound: (resource = "리소스") =>
    error("NOT_FOUND", `${resource}을(를) 찾을 수 없습니다`, 404),
  badRequest: (message: string, details?: unknown) =>
    error("BAD_REQUEST", message, 400, details),
  conflict: (message: string) => error("CONFLICT", message, 409),
  tooManyRequests: (message = "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.") =>
    error("TOO_MANY_REQUESTS", message, 429),
  internal: (message = "서버 오류가 발생했습니다") =>
    error("INTERNAL_ERROR", message, 500),
} as const;
