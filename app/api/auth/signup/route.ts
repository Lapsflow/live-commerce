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
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = signupSchema.parse(body);

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
        passwordHash,
      },
    });

    return ok({ id: user.id, name: user.name, role: user.role });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    return error("SIGNUP_FAILED", err.message, 500);
  }
}
