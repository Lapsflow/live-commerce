import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { validateCenterCode } from "@/lib/validators/center";

const signupSchema = z.object({
  username: z.string().min(3).max(50), // 로그인용 아이디 (pptx 스펙)
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().min(10).max(11), // 필수 (pptx 스펙)
  email: z.string().email().optional(), // 실제 이메일 (선택)
  role: z.enum(["SELLER", "ADMIN"]),
  adminId: z.string().optional(),
  centerId: z.string(), // Required - center assignment

  // SELLER 1차 정보
  channels: z.array(z.string()).optional(), // Required if role=SELLER
  avgSales: z.number().optional(), // Required if role=SELLER

  // SELLER 2차 정보 (선택)
  categories: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  timeSlots: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = signupSchema.parse(body);

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

    // Validate SELLER-specific fields
    if (data.role === "SELLER") {
      if (!data.channels || data.channels.length === 0) {
        return error("VALIDATION_ERROR", "판매자는 활동 채널을 선택해야 합니다.", 400);
      }
      if (!data.avgSales || data.avgSales <= 0) {
        return error("VALIDATION_ERROR", "판매자는 월평균 매출을 입력해야 합니다.", 400);
      }
    }

    // 중복 확인 (username)
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existing) {
      return error("USER_EXISTS", "이미 존재하는 아이디입니다.", 400);
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        username: data.username, // 로그인용 아이디 (pptx 스펙)
        email: data.email, // 실제 이메일 (선택)
        name: data.name,
        phone: data.phone, // 필수 (pptx 스펙)
        role: data.role,
        adminId: data.adminId,
        centerId: data.centerId, // Center assignment

        // SELLER 1차 정보
        channels: data.role === "SELLER" ? data.channels : [],
        avgSales: data.role === "SELLER" ? data.avgSales : undefined,

        // SELLER 2차 정보 (선택)
        categories: data.categories || [],
        regions: data.regions || [],
        timeSlots: data.timeSlots || [],

        contractStatus: data.role === "SELLER" ? "PENDING" : "APPROVED", // SELLER needs approval
        passwordHash,
      },
    });

    return ok({
      id: user.id,
      name: user.name,
      role: user.role,
      contractStatus: user.contractStatus,
      message: data.role === "SELLER" ? "계약 승인 대기 중입니다. 관리자 승인 후 로그인 가능합니다." : undefined,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    return error("SIGNUP_FAILED", err.message, 500);
  }
}
