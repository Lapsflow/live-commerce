import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { auth } from "@/lib/auth";

const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["MASTER", "SUB_MASTER", "ADMIN", "SELLER"]).optional(),
  adminId: z.string().nullable().optional(),
  channels: z.array(z.string()).optional(),
  avgSales: z.number().nullable().optional(),
});

/**
 * GET /api/users/:id
 *
 * 사용자 상세 조회
 * 권한: MASTER, SUB_MASTER만 가능
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest) => {
    try {
      const userId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!userId) {
        return errors.badRequest("User ID가 필요합니다");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          adminId: true,
          channels: true,
          avgSales: true,
          createdAt: true,
        },
      });

      if (!user) {
        return errors.notFound("user");
      }

      return ok(user);
    } catch (err: any) {
      console.error("User GET error:", err);
      return errors.internal(err.message);
    }
  }
);

/**
 * PUT /api/users/:id
 *
 * 사용자 정보 수정
 * 권한: MASTER, SUB_MASTER만 가능
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      const userId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!userId) {
        return errors.badRequest("User ID가 필요합니다");
      }

      const body = await req.json();
      const data = userUpdateSchema.parse(body);

      // 사용자 존재 여부 확인
      const existing = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        return errors.notFound("user");
      }

      // 사용자 정보 업데이트
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.role !== undefined && { role: data.role }),
          ...(data.adminId !== undefined && { adminId: data.adminId }),
          ...(data.channels !== undefined && { channels: data.channels }),
          ...(data.avgSales !== undefined && { avgSales: data.avgSales }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          adminId: true,
          channels: true,
          avgSales: true,
          createdAt: true,
        },
      });

      return ok(updatedUser);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return errors.badRequest(err.issues[0].message);
      }
      console.error("User PUT error:", err);
      return errors.internal(err.message);
    }
  }
);

/**
 * DELETE /api/users/:id
 *
 * 사용자 삭제
 * 권한: MASTER만 가능
 */
export const DELETE = withRole(
  ["MASTER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      const userId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!userId) {
        return errors.badRequest("User ID가 필요합니다");
      }

      const currentUserId = (session.user as any).userId;

      // 본인 삭제 방지
      if (userId === currentUserId) {
        return errors.badRequest("본인 계정은 삭제할 수 없습니다");
      }

      // 사용자 존재 여부 확인
      const existing = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        return errors.notFound("user");
      }

      // 사용자 삭제
      await prisma.user.delete({
        where: { id: userId },
      });

      return ok({ message: "사용자가 삭제되었습니다", id: userId });
    } catch (err: any) {
      console.error("User DELETE error:", err);
      return errors.internal(err.message);
    }
  }
);
