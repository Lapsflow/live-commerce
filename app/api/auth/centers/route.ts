/**
 * GET /api/auth/centers - 회원가입용 공개 센터 목록
 * 인증 불필요 - 회원가입 페이지에서 센터 선택에 사용
 * 최소 정보만 반환 (id, name, code)
 */

import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const centers = await prisma.center.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { code: "asc" },
    });

    return ok(centers);
  } catch (err: any) {
    console.error("Failed to fetch centers for signup:", err);
    return error("FETCH_FAILED", "센터 목록을 가져올 수 없습니다.", 500);
  }
}
