/**
 * PATCH /api/auth/signup/profile - 가입 직후 추가 정보 저장
 * 인증 불필요 - 가입 완료 직후 2단계에서 호출
 */

import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const profileSchema = z.object({
  userId: z.string(),
  channels: z.array(z.string()).optional(),
  avgSales: z.string().optional(), // "100만원 이하", "100~500만원" 등 문자열
});

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const data = profileSchema.parse(body);

    // 사용자 존재 확인 + PENDING 상태인지 확인
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      return error("USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", 404);
    }

    if (user.contractStatus !== "PENDING") {
      return error("INVALID_STATUS", "프로필 수정이 불가능한 상태입니다.", 400);
    }

    // avgSales 문자열을 숫자로 변환
    let avgSalesNum: number | undefined;
    if (data.avgSales) {
      const salesMap: Record<string, number> = {
        "100만원 이하": 50,
        "100~500만원": 300,
        "500~1000만원": 750,
        "1000~3000만원": 2000,
        "3000만~1억": 6500,
        "1억 이상": 15000,
      };
      avgSalesNum = salesMap[data.avgSales] || 0;
    }

    const updatedUser = await prisma.user.update({
      where: { id: data.userId },
      data: {
        channels: data.channels || [],
        avgSales: avgSalesNum,
      },
      select: {
        id: true,
        name: true,
        channels: true,
        avgSales: true,
      },
    });

    return ok(updatedUser);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    return error("PROFILE_UPDATE_FAILED", err.message, 500);
  }
}
