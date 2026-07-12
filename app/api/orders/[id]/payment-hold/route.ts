/**
 * POST /api/orders/[id]/payment-hold — 입금 보류 지정/해제 (MASTER/SUB_MASTER)
 *
 * 발주관리 개선 (2026-07-10, 한국무진 요청 3번 "보류"):
 * - 협의 중이거나 확인이 필요한 발주를 "보류" 로 표시 (수동 지정)
 * - body: { hold: boolean } — true 면 ON_HOLD, false 면 UNPAID 로 복귀
 * - 보류 상태는 자동 처리(입금확인 흐름) 대상에서 제외되며, 입금완료 처리 시 해제됨
 */

import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";

export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    // 동일 패턴: payment-confirm/route.ts 의 URL 파싱 방식
    const orderId = req.url.split("/orders/")[1]?.split("/payment-hold")[0];
    if (!orderId) {
      return errors.badRequest("발주 ID가 필요합니다");
    }

    let hold = true;
    try {
      const body = await req.json();
      if (typeof body?.hold === "boolean") hold = body.hold;
    } catch {
      // body 없으면 보류 지정으로 간주
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { seller: { select: { name: true, centerId: true } } },
    });

    if (!order) {
      return errors.notFound("발주를 찾을 수 없습니다");
    }

    // SUB_MASTER: 본인 센터 셀러의 CENTER 발주만
    if (user.role === "SUB_MASTER" && user.centerId) {
      if (order.seller?.centerId !== user.centerId) {
        return errors.forbidden("본인 센터의 발주만 처리할 수 있습니다");
      }
      if (order.productType === "HEADQUARTERS") {
        return errors.forbidden("본사 제품 발주는 본사에서 처리합니다");
      }
    }

    if (order.paymentStatus === "PAID") {
      return errors.badRequest("이미 입금완료된 발주는 보류할 수 없습니다");
    }
    if (hold && order.paymentStatus === "ON_HOLD") {
      return errors.badRequest("이미 보류 상태입니다");
    }
    if (!hold && order.paymentStatus !== "ON_HOLD") {
      return errors.badRequest("보류 상태가 아닙니다");
    }

    const before = order.paymentStatus;
    const after = hold ? "ON_HOLD" : "UNPAID";

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: after },
    });

    logAudit({
      userId: user.userId,
      userRole: user.role,
      userName: user.name,
      action: "UPDATE",
      entityType: "Order",
      entityId: orderId,
      entityName: order.orderNo,
      before: { paymentStatus: before },
      after: { paymentStatus: after },
      description: hold
        ? `입금 보류 지정: ${order.orderNo} (${order.seller?.name ?? "-"})`
        : `입금 보류 해제: ${order.orderNo} (${order.seller?.name ?? "-"})`,
      request: req,
    });

    return ok({ id: updated.id, paymentStatus: updated.paymentStatus });
  }
);
