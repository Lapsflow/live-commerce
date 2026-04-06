import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/proposals/:id
 *
 * 제안 상세 조회
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

      // URL에서 proposalId 추출
      const proposalId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!proposalId) {
        return errors.badRequest("Proposal ID가 필요합니다");
      }

      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;

      // Proposal 조회
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              adminId: true,
            },
          },
        },
      });

      if (!proposal) {
        return errors.notFound("proposal");
      }

      // 권한 검증
      if (userRole === "SELLER" && proposal.submittedBy !== userId) {
        return errors.forbidden("본인의 제안만 조회할 수 있습니다");
      }

      if (userRole === "ADMIN" && proposal.user.adminId !== userId) {
        return errors.forbidden("소속 Seller의 제안만 조회할 수 있습니다");
      }

      return ok(proposal);
    } catch (err: any) {
      console.error("Proposal GET error:", err);
      return errors.internal(err.message);
    }
  }
);

/**
 * DELETE /api/proposals/:id
 *
 * 제안 삭제
 * 권한:
 * - SELLER: 본인의 PENDING 제안만 삭제 가능
 * - ADMIN: 소속 Seller의 PENDING 제안 삭제 가능
 * - MASTER, SUB_MASTER: 모든 제안 삭제 가능
 */
export const DELETE = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      // URL에서 proposalId 추출
      const proposalId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!proposalId) {
        return errors.badRequest("Proposal ID가 필요합니다");
      }

      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;

      // Proposal 조회
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              adminId: true,
            },
          },
        },
      });

      if (!proposal) {
        return errors.notFound("proposal");
      }

      // 권한 검증
      if (userRole === "SELLER" && proposal.submittedBy !== userId) {
        return errors.forbidden("본인의 제안만 삭제할 수 있습니다");
      }

      if (userRole === "ADMIN" && proposal.user.adminId !== userId) {
        return errors.forbidden("소속 Seller의 제안만 삭제할 수 있습니다");
      }

      // SELLER와 ADMIN은 PENDING 상태만 삭제 가능
      if ((userRole === "SELLER" || userRole === "ADMIN") && proposal.status !== "PENDING") {
        return errors.badRequest("PENDING 상태의 제안만 삭제할 수 있습니다");
      }

      // 제안 삭제
      await prisma.proposal.delete({
        where: { id: proposalId },
      });

      return ok({ message: "제안이 삭제되었습니다", id: proposalId });
    } catch (err: any) {
      console.error("Proposal DELETE error:", err);
      return errors.internal(err.message);
    }
  }
);
