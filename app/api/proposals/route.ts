import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const proposalCreateSchema = z.object({
  companyName: z.string().min(1, "업체명을 입력하세요"),
  contact: z.string().min(1, "담당자를 입력하세요"),
  phone: z.string().min(1, "연락처를 입력하세요"),
  productName: z.string().min(1, "상품명을 입력하세요"),
  category: z.string().min(1, "카테고리를 입력하세요"),
  description: z.string().min(1, "설명을 입력하세요"),
});

/**
 * POST /api/proposals
 *
 * 제안 등록
 * 권한: 모든 로그인 사용자
 */
export const POST = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      const userId = (session.user as any).userId;

      const body = await req.json();
      const data = proposalCreateSchema.parse(body);

      const proposal = await prisma.proposal.create({
        data: {
          ...data,
          submittedBy: userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return ok(proposal);
    } catch (err: any) {
      console.error("Proposal create error:", err);

      if (err.name === "ZodError") {
        return errors.badRequest(err.issues[0].message);
      }

      return errors.internal(err.message);
    }
  }
);

/**
 * GET /api/proposals
 *
 * 제안 목록 조회
 *
 * Query Parameters:
 * - status?: PENDING | APPROVED | REJECTED
 *
 * 권한:
 * - SELLER: 본인 제안만 조회
 * - ADMIN: 소속 Seller 제안 조회
 * - MASTER, SUB_MASTER: 모든 제안 조회
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;
      const { searchParams } = new URL(req.url);
      const statusFilter = searchParams.get("status");

      // 역할별 필터
      let userFilter = {};
      if (userRole === "SELLER") {
        userFilter = { submittedBy: userId };
      } else if (userRole === "ADMIN") {
        // Admin이 관리하는 Seller 목록 조회
        const sellers = await prisma.user.findMany({
          where: { adminId: userId },
          select: { id: true },
        });
        const sellerIds = sellers.map((s) => s.id);
        userFilter = { submittedBy: { in: sellerIds } };
      }

      // 상태 필터
      const statusWhere = statusFilter
        ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" }
        : {};

      const proposals = await prisma.proposal.findMany({
        where: {
          ...userFilter,
          ...statusWhere,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return ok(proposals);
    } catch (err: any) {
      console.error("Proposals list error:", err);
      return errors.internal(err.message);
    }
  }
);
