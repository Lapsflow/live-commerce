import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const bulkDeleteSchema = z.object({
  orderIds: z.array(z.string()).min(1, "최소 1개의 주문을 선택해야 합니다"),
});

/**
 * DELETE /api/orders/bulk
 *
 * 여러 발주를 한 번에 삭제
 * 권한: MASTER, SUB_MASTER, ADMIN만 가능
 *
 * Request Body:
 * {
 *   orderIds: string[]
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     deleted: number,
 *     failed: number,
 *     results: Array<{ id: string, success: boolean, error?: string }>
 *   }
 * }
 */
export const DELETE = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN"],
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const data = bulkDeleteSchema.parse(body);

      // 트랜잭션으로 일괄 삭제
      const results = await prisma.$transaction(async (tx) => {
        const deleteResults: Array<{
          id: string;
          success: boolean;
          error?: string;
        }> = [];

        for (const orderId of data.orderIds) {
          try {
            // 주문 존재 여부 확인
            const existing = await tx.order.findUnique({
              where: { id: orderId },
            });

            if (!existing) {
              deleteResults.push({
                id: orderId,
                success: false,
                error: "주문을 찾을 수 없습니다",
              });
              continue;
            }

            // 주문 삭제
            await tx.order.delete({
              where: { id: orderId },
            });

            deleteResults.push({
              id: orderId,
              success: true,
            });
          } catch (err: any) {
            deleteResults.push({
              id: orderId,
              success: false,
              error: err.message || "삭제 실패",
            });
          }
        }

        return deleteResults;
      });

      // 성공/실패 집계
      const deleted = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return ok({
        deleted,
        failed,
        results,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return errors.badRequest(err.issues[0].message);
      }
      return errors.internal(err.message);
    }
  }
);
