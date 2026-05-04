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
 * - MASTER, SUB_MASTER: 모든 제안 조회
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER"],
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
            },
          },
        },
      });

      if (!proposal) {
        return errors.notFound("proposal");
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
 * - MASTER, SUB_MASTER: 모든 제안 삭제 가능
 */
export const DELETE = withRole(
  ["MASTER", "SUB_MASTER"],
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
            },
          },
        },
      });

      if (!proposal) {
        return errors.notFound("proposal");
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
