// LIVE-03: 수동 매칭 / 매칭 해제 API
import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { z } from "zod";
import {
  manualMatchOrderToBroadcast,
  unmatchOrderFromBroadcast,
} from "@/lib/services/broadcast/orderBroadcastMatching";

const matchSchema = z.object({
  broadcastId: z.string().cuid(),
});

// POST: 수동 매칭
export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (
    req: NextRequest,
    user: AuthUser,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const data = matchSchema.parse(body);

      const result = await manualMatchOrderToBroadcast(id, data.broadcastId);

      if (!result.matched) {
        return error("MATCH_FAILED", result.reason, 400);
      }

      return ok(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return error("VALIDATION_ERROR", err.issues[0].message, 400);
      }
      console.error("[MANUAL MATCH ERROR]", err);
      return error("MATCH_FAILED", err.message, 500);
    }
  }
);

// DELETE: 매칭 해제
export const DELETE = withRole(
  ["MASTER", "SUB_MASTER"],
  async (
    req: NextRequest,
    user: AuthUser,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      await unmatchOrderFromBroadcast(id);
      return ok({ message: "매칭이 해제되었습니다." });
    } catch (err: any) {
      console.error("[UNMATCH ERROR]", err);
      return error("UNMATCH_FAILED", err.message, 500);
    }
  }
);
