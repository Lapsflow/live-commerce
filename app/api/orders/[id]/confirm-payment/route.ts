/**
 * POST /api/orders/[id]/confirm-payment - 입금 확인
 * 관리자가 입금을 확인하면:
 * 1. 재고 선점 → 실제 차감으로 전환
 * 2. WMS 자동 전송
 */

import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { withRole } from "@/lib/api/middleware";
import { convertReservation } from "@/lib/services/stock/reservation";
import { syncOrderToOnewms } from "@/lib/services/onewms/orderSync";

export const POST = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN"],
  async (
    req: NextRequest,
    _user,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: orderId } = await params;

      // 1. 예약 전환 (입금확인 + 재고 차감)
      const result = await convertReservation(orderId);

      if (!result.success) {
        return error("PAYMENT_CONFIRM_FAILED", result.error || "입금확인 처리 실패", 400);
      }

      // 2. WMS 자동 전송 (실패해도 입금확인은 유지)
      let wmsResult = null;
      try {
        wmsResult = await syncOrderToOnewms(orderId);
      } catch (wmsErr) {
        console.error("[WMS_SYNC_AFTER_PAYMENT]", wmsErr);
        // WMS 실패 시 기존 retry 메커니즘이 처리
      }

      return ok({
        message: "입금이 확인되었습니다.",
        orderId,
        wmsSync: wmsResult
          ? { success: wmsResult.success, onewmsOrderNo: wmsResult.onewmsOrderNo }
          : { success: false, error: "WMS 전송 대기 중 (자동 재시도 예정)" },
      });
    } catch (err: any) {
      console.error("[CONFIRM_PAYMENT ERROR]", err);
      return error("CONFIRM_PAYMENT_ERROR", err.message, 500);
    }
  }
);
