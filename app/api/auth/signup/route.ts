import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { validateCenterCode } from "@/lib/validators/center";

const signupSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8), // PDF 스펙: 8자 이상
  name: z.string().min(1),
  phone: z.string().min(10).max(13), // 010-1234-1234 형식도 허용
  email: z.string().email(), // PDF 스펙: 필수
  centerId: z.string(), // 소속 센터 (필수)
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = signupSchema.parse(body);

    // 휴대폰번호에서 하이픈 제거하여 저장
    const phoneDigits = data.phone.replace(/-/g, "");

    // Validate center exists
    const center = await prisma.center.findUnique({
      where: { id: data.centerId },
    });

    if (!center) {
      return error("CENTER_NOT_FOUND", "존재하지 않는 센터입니다.", 400);
    }

    // Validate center code format (pptx 스펙)
    if (!validateCenterCode(center.code)) {
      return error(
        "INVALID_CENTER_CODE",
        "센터 코드 형식이 올바르지 않습니다. 형식: [01-17]-[4자리 숫자]",
        400
      );
    }

    // 중복 확인 (username)
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existing) {
      return error("USER_EXISTS", "이미 존재하는 아이디입니다.", 400);
    }

    // 이메일 중복 확인
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingEmail) {
      return error("EMAIL_EXISTS", "이미 사용 중인 이메일입니다.", 400);
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 사용자 생성 (회원가입은 항상 SELLER, ADMIN은 수기 등록)
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        name: data.name,
        phone: phoneDigits,
        role: "SELLER",
        centerId: data.centerId,
        contractStatus: "PENDING",
        passwordHash,
      },
    });

    return ok({
      id: user.id,
      name: user.name,
      role: user.role,
      contractStatus: user.contractStatus,
      message: "가입 신청이 완료되었습니다! 관리자 승인 후 로그인 가능합니다.",
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      const issue = err.issues[0];
      let message = issue.message;
      if (issue.path[0] === "password" && issue.code === "too_small") {
        message = "비밀번호는 8자 이상이어야 합니다.";
      }
      if (issue.path[0] === "email") {
        message = "올바른 이메일 형식을 입력해주세요.";
      }
      return error("VALIDATION_ERROR", message, 400);
    }
    return error("SIGNUP_FAILED", err.message, 500);
  }
}
