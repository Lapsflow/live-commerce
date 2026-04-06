import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const bulkStatusUpdateSchema = z.object({
  orderIds: z.array(z.string()).min(1, "최소 1개의 주문을 선택해야 합니다"),
  paymentStatus: z.enum(["UNPAID", "PAID"]).optional(),
  shippingStatus: z
    .enum(["PENDING", "PREPARING", "SHIPPED", "PARTIAL"])
    .optional(),
});

/**
 * PUT /api/orders/bulk-status
 *
 * 여러 발주의 상태를 한 번에 변경 (입금/출고)
 * 권한: MASTER, SUB_MASTER, ADMIN만 가능
 *
 * Request Body:
 * {
 *   orderIds: string[],
 *   paymentStatus?: "UNPAID" | "PAID",
 *   shippingStatus?: "PENDING" | "PREPARING" | "SHIPPED" | "PARTIAL"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     updated: number,
 *     failed: number,
 *     results: Array<{ id: string, success: boolean, error?: string }>
 *   }
 * }
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN"],
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const data = bulkStatusUpdateSchema.parse(body);

      // 최소 하나의 상태는 업데이트 되어야 함
      if (!data.paymentStatus && !data.shippingStatus) {
        return errors.badRequest("최소 하나의 상태를 업데이트해야 합니다");
      }

      // 트랜잭션으로 일괄 업데이트
      const results = await prisma.$transaction(async (tx) => {
        const updateResults: Array<{
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
              updateResults.push({
                id: orderId,
                success: false,
                error: "주문을 찾을 수 없습니다",
              });
              continue;
            }

            // 상태 업데이트
            await tx.order.update({
              where: { id: orderId },
              data: {
                ...(data.paymentStatus && {
                  paymentStatus: data.paymentStatus,
                }),
                ...(data.shippingStatus && {
                  shippingStatus: data.shippingStatus,
                }),
              },
            });

            updateResults.push({
              id: orderId,
              success: true,
            });
          } catch (err: any) {
            updateResults.push({
              id: orderId,
              success: false,
              error: err.message || "업데이트 실패",
            });
          }
        }

        return updateResults;
      });

      // 성공/실패 집계
      const updated = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return ok({
        updated,
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
