import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

/**
 * GET /api/users/:id/profile
 *
 * 사용자 프로필 조회
 *
 * 권한:
 * - SELLER: 본인 프로필만 조회 가능
 * - ADMIN: 소속 Seller 프로필 조회 가능
 * - MASTER, SUB_MASTER: 모든 사용자 프로필 조회 가능
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      // URL에서 userId 추출
      const userId = req.url.split("/").filter(s => s).slice(-2)[0];
      if (!userId) {
        return errors.badRequest("User ID가 필요합니다");
      }

      const userRole = (session.user as any).role;
      const sessionUserId = (session.user as any).userId;

      // SELLER는 본인만 조회
      if (userRole === "SELLER" && sessionUserId !== userId) {
        return errors.forbidden("본인의 프로필만 조회할 수 있습니다");
      }

      // 사용자 조회
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
          updatedAt: true,
        },
      });

      if (!user) {
        return errors.notFound("user");
      }

      // ADMIN은 자신이 관리하는 Seller만 조회
      if (userRole === "ADMIN" && user.adminId !== sessionUserId) {
        return errors.forbidden("관리하는 Seller의 프로필만 조회할 수 있습니다");
      }

      return ok(user);
    } catch (err: any) {
      console.error("User profile GET error:", err);
      return errors.internal(err.message);
    }
  }
);

/**
 * PUT /api/users/:id/profile
 *
 * 사용자 프로필 수정
 *
 * Body:
 * - channels?: string[] (활동 채널)
 * - avgSales?: number (평균 매출)
 * - name?: string (이름)
 * - phone?: string (전화번호)
 *
 * 권한:
 * - SELLER: 본인 프로필만 수정 가능
 * - ADMIN: 소속 Seller 프로필 수정 가능
 * - MASTER, SUB_MASTER: 모든 사용자 프로필 수정 가능
 */

const profileUpdateSchema = z.object({
  channels: z.array(z.string()).optional(),
  avgSales: z.number().int().nullable().optional(),
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
});

export const PUT = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      // URL에서 userId 추출
      const userId = req.url.split("/").filter(s => s).slice(-2)[0];
      if (!userId) {
        return errors.badRequest("User ID가 필요합니다");
      }

      const userRole = (session.user as any).role;
      const sessionUserId = (session.user as any).userId;

      // SELLER는 본인만 수정
      if (userRole === "SELLER" && sessionUserId !== userId) {
        return errors.forbidden("본인의 프로필만 수정할 수 있습니다");
      }

      // 사용자 존재 확인
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, adminId: true },
      });

      if (!existingUser) {
        return errors.notFound("user");
      }

      // ADMIN은 자신이 관리하는 Seller만 수정
      if (userRole === "ADMIN" && existingUser.adminId !== sessionUserId) {
        return errors.forbidden("관리하는 Seller의 프로필만 수정할 수 있습니다");
      }

      // 요청 본문 파싱 및 검증
      const body = await req.json();
      const data = profileUpdateSchema.parse(body);

      // 프로필 업데이트
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.channels !== undefined && { channels: data.channels }),
          ...(data.avgSales !== undefined && { avgSales: data.avgSales }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone }),
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
          updatedAt: true,
        },
      });

      return ok(updatedUser);
    } catch (err: any) {
      console.error("User profile PUT error:", err);

      if (err.name === "ZodError") {
        return errors.badRequest(err.issues[0].message);
      }

      return errors.internal(err.message);
    }
  }
);
