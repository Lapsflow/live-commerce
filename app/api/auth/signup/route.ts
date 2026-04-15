import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const signupSchema = z.object({
  id: z.string().min(3).max(50),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["SELLER", "ADMIN"]),
  adminId: z.string().optional(),
  centerId: z.string(), // Required - center assignment
  channels: z.array(z.string()).optional(), // Required if role=SELLER
  avgSales: z.number().optional(), // Required if role=SELLER
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

    // Validate SELLER-specific fields
    if (data.role === "SELLER") {
      if (!data.channels || data.channels.length === 0) {
        return error("VALIDATION_ERROR", "판매자는 활동 채널을 선택해야 합니다.", 400);
      }
      if (!data.avgSales) {
        return error("VALIDATION_ERROR", "판매자는 월평균 매출을 입력해야 합니다.", 400);
      }
    }

    // 중복 확인 (id를 email로 사용)
    const existing = await prisma.user.findUnique({
      where: { email: data.id },
    });

    if (existing) {
      return error("USER_EXISTS", "이미 존재하는 아이디입니다.", 400);
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email: data.id, // id를 email 필드로 사용
        name: data.name,
        phone: data.phone,
        role: data.role,
        adminId: data.adminId,
        centerId: data.centerId, // Center assignment
        channels: data.role === "SELLER" ? data.channels : [],
        avgSales: data.role === "SELLER" ? data.avgSales : undefined,
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
