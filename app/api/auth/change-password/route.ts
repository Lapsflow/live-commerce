import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { withAuth } from "@/lib/api/middleware";
import bcrypt from "bcryptjs";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
  newPassword: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다"),
});

/**
 * POST /api/auth/change-password
 * 비밀번호 변경 (로그인된 사용자 본인만)
 */
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const data = changePasswordSchema.parse(body);

    // 현재 사용자 조회
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { passwordHash: true },
    });

    if (!dbUser?.passwordHash) {
      return error("USER_NOT_FOUND", "사용자를 찾을 수 없습니다", 404);
    }

    // 현재 비밀번호 확인
    const isValid = await bcrypt.compare(data.currentPassword, dbUser.passwordHash);
    if (!isValid) {
      return error("INVALID_PASSWORD", "현재 비밀번호가 올바르지 않습니다", 400);
    }

    // 새 비밀번호 해싱 및 저장
    const newHash = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { id: user.userId },
      data: { passwordHash: newHash },
    });

    return ok({ message: "비밀번호가 변경되었습니다" });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    console.error("[CHANGE PASSWORD ERROR]", err);
    return error("CHANGE_FAILED", "비밀번호 변경 실패", 500);
  }
});
