import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const statusUpdateSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

/**
 * PUT /api/proposals/:id/status
 *
 * 제안 상태 변경
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

      // URL에서 proposalId 추출
      const proposalId = req.url.split("/").filter(s => s).slice(-2)[0];
      if (!proposalId) {
        return errors.badRequest("Proposal ID가 필요합니다");
      }

      const body = await req.json();
      const data = statusUpdateSchema.parse(body);

      // Proposal 존재 확인
      const existing = await prisma.proposal.findUnique({
        where: { id: proposalId },
      });

      if (!existing) {
        return errors.notFound("proposal");
      }

      // 상태 업데이트
      const updated = await prisma.proposal.update({
        where: { id: proposalId },
        data: {
          status: data.status,
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

      return ok(updated);
    } catch (err: any) {
      console.error("Proposal status update error:", err);

      if (err.name === "ZodError") {
        return errors.badRequest(err.issues[0].message);
      }

      return errors.internal(err.message);
    }
  }
);
