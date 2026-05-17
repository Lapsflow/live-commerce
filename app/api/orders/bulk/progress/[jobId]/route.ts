import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

// ──────────────────────── GET: 업로드 진행률 폴링 ────────────────────────
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "SELLER"],
  async (req: NextRequest, user: AuthUser, { params }: { params: { jobId: string } }) => {
    try {
      const { jobId } = params;

      // ✅ Task 6: UploadJob 조회
      const job = await prisma.uploadJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return errors.notFound("작업을 찾을 수 없습니다.");
      }

      // ✅ 권한 확인: 자신의 작업만 조회 가능
      if (job.userId !== user.userId) {
        return errors.forbidden("다른 사용자의 작업은 조회할 수 없습니다.");
      }

      // ✅ 진행률 응답
      return ok({
        jobId: job.id,
        processedItems: job.processedItems,
        totalItems: job.totalItems,
        status: job.status,
        progress: Math.round((job.processedItems / job.totalItems) * 100),
        ...(job.errorMessage && { errorMessage: job.errorMessage }),
        ...(job.result && { result: job.result }),
      });
    } catch (err: any) {
      console.error("[BULK PROGRESS ERROR]", err);
      return errors.internal(err.message || "진행률 조회 실패");
    }
  }
);
