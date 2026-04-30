import { createCrudHandler } from "@/lib/api/create-crud-handler-prisma";
import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { errors, created } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { logAudit } from "@/lib/services/audit";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  role: z.enum(["MASTER", "SUB_MASTER", "ADMIN", "SELLER"]).optional(),
  adminId: z.string().cuid().optional(),
});

// GET은 기존 CRUD factory 유지
const crud = createCrudHandler({
  model: "user",
  roles: {
    read: ["MASTER", "SUB_MASTER", "ADMIN"],
    write: ["MASTER", "SUB_MASTER"],
  },
  createSchema: userSchema,
  updateSchema: userSchema.partial(),
  sortableFields: ["email", "name", "role", "createdAt"],
  searchFields: ["email", "name", "phone"],
  excludeFields: ["passwordHash"],
});

export const GET = crud.list;

// POST: MASTER 계정 1개 강제 정책 적용
export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const body = await req.json();
      const validated = userSchema.parse(body);

      // MASTER 계정 1개 강제
      if (validated.role === "MASTER") {
        const masterCount = await prisma.user.count({
          where: { role: "MASTER" },
        });
        if (masterCount >= 1) {
          return errors.badRequest("마스터 계정은 1개만 허용됩니다");
        }
      }

      const record = await prisma.user.create({ data: validated as any });

      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "CREATE",
        entityType: "User",
        entityId: record.id,
        entityName: record.name,
        after: validated as Record<string, unknown>,
        description: `사용자 생성: ${record.name} (${validated.role || "SELLER"})`,
        request: req,
      });

      return created(record);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return errors.badRequest(err.issues[0].message);
      }
      console.error("[Users POST] Error:", err);
      return errors.internal(err.message);
    }
  }
);
