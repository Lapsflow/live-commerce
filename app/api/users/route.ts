import { createCrudHandler } from "@/lib/api/create-crud-handler-prisma";
import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { errors, created } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { logAudit } from "@/lib/services/audit";
import bcrypt from "bcryptjs";

const userCreateSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  role: z.enum(["SUB_MASTER", "SELLER"]),
  centerId: z.string().optional(),
});

// GET은 기존 CRUD factory 유지
const crud = createCrudHandler({
  model: "user",
  roles: {
    read: ["MASTER", "SUB_MASTER"],
    write: ["MASTER", "SUB_MASTER"],
  },
  createSchema: userCreateSchema,
  updateSchema: z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    phone: z.string().max(20).optional(),
    role: z.enum(["MASTER", "SUB_MASTER", "SELLER"]).optional(),
  }).partial(),
  sortableFields: ["email", "name", "role", "createdAt"],
  searchFields: ["email", "name", "phone"],
  excludeFields: ["passwordHash"],
  include: { center: { select: { id: true, name: true, code: true } } },
});

export const GET = crud.list;

// POST: 관리자가 사용자 생성 (아이디 + 비밀번호 포함)
export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const body = await req.json();
      const validated = userCreateSchema.parse(body);

      // SUB_MASTER는 SELLER만 생성 가능, 본인 센터로 고정
      if (user.role === "SUB_MASTER") {
        if (validated.role !== "SELLER") {
          return errors.badRequest("센터 관리자는 셀러만 생성할 수 있습니다");
        }
        validated.centerId = user.centerId || undefined;
      }

      // 중복 확인 (username)
      const existingUsername = await prisma.user.findUnique({
        where: { username: validated.username },
      });
      if (existingUsername) {
        return errors.badRequest("이미 존재하는 아이디입니다");
      }

      // 이메일 중복 확인
      const existingEmail = await prisma.user.findUnique({
        where: { email: validated.email },
      });
      if (existingEmail) {
        return errors.badRequest("이미 사용 중인 이메일입니다");
      }

      // 비밀번호 해싱
      const passwordHash = await bcrypt.hash(validated.password, 10);
      const phoneDigits = validated.phone?.replace(/-/g, "") || null;

      const record = await prisma.user.create({
        data: {
          username: validated.username,
          email: validated.email,
          name: validated.name,
          phone: phoneDigits || "",
          role: validated.role,
          centerId: validated.centerId || null,
          contractStatus: "APPROVED",
          passwordHash,
          isActive: true,
        },
        include: { center: { select: { id: true, name: true, code: true } } },
      });

      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "CREATE",
        entityType: "User",
        entityId: record.id,
        entityName: record.name,
        after: { username: validated.username, name: validated.name, role: validated.role, centerId: validated.centerId } as Record<string, unknown>,
        description: `사용자 생성: ${record.name} (${validated.role})`,
        request: req,
      });

      // passwordHash 제거 후 반환
      const { passwordHash: _, ...safeRecord } = record;
      return created(safeRecord);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return errors.badRequest(err.issues[0].message);
      }
      console.error("[Users POST] Error:", err);
      return errors.internal(err.message);
    }
  }
);
