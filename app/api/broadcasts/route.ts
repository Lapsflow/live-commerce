import { NextRequest } from "next/server";
import { createCrudHandler } from "@/lib/api/create-crud-handler-prisma";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { created, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const broadcastSchema = z.object({
  code: z.string().min(1).max(50),
  sellerId: z.string().cuid(),
  platform: z.enum(["GRIP", "CLME", "YOUTUBE", "TIKTOK", "BAND", "OTHER"]),
  scheduledAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  status: z.enum(["REQUESTED", "SCHEDULED", "LIVE", "ENDED", "CANCELED", "REJECTED"]).optional(),
  requestMemo: z.string().max(500).optional(),
  memo: z.string().max(500).optional(),
});

// GET은 기존 CRUD factory 사용
export const { list: GET } = createCrudHandler({
  model: "broadcast",
  roles: {
    read: ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
    write: ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  },
  createSchema: broadcastSchema,
  updateSchema: broadcastSchema.partial(),
  sortableFields: ["code", "platform", "status", "scheduledAt", "createdAt"],
  searchFields: ["code"],
  excludeFields: [],
});

// POST: 충돌 방지 로직 포함 커스텀 핸들러
const CONFLICT_WINDOW_HOURS = 2;

export const POST = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const body = await req.json();
      const validation = broadcastSchema.safeParse(body);
      if (!validation.success) {
        return errors.badRequest("유효성 검증 실패", validation.error.format());
      }

      const data = validation.data;
      const scheduledAt = new Date(data.scheduledAt);

      // 충돌 체크: 동일 셀러, ±2시간 이내, SCHEDULED/LIVE 상태
      const windowMs = CONFLICT_WINDOW_HOURS * 60 * 60 * 1000;
      const windowStart = new Date(scheduledAt.getTime() - windowMs);
      const windowEnd = new Date(scheduledAt.getTime() + windowMs);

      const conflicting = await prisma.broadcast.findFirst({
        where: {
          sellerId: data.sellerId,
          scheduledAt: {
            gte: windowStart,
            lte: windowEnd,
          },
          status: { in: ["REQUESTED", "SCHEDULED", "LIVE"] },
        },
        select: {
          id: true,
          code: true,
          platform: true,
          scheduledAt: true,
          status: true,
        },
      });

      if (conflicting) {
        return errors.badRequest(
          `일정 충돌: 동일 셀러의 방송 "${conflicting.code}" (${conflicting.platform})이 ${new Date(conflicting.scheduledAt).toLocaleString("ko-KR")}에 이미 예정되어 있습니다. 최소 ${CONFLICT_WINDOW_HOURS}시간 간격이 필요합니다.`
        );
      }

      // 충돌 없으면 생성
      const broadcast = await prisma.broadcast.create({
        data: {
          code: data.code,
          sellerId: data.sellerId,
          platform: data.platform,
          scheduledAt: new Date(data.scheduledAt),
          startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
          endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
          status: data.status || "REQUESTED",
          requestMemo: data.requestMemo,
          memo: data.memo,
        },
      });

      return created(broadcast);
    } catch (error) {
      console.error("[Broadcast] Failed to create:", error);
      const message = error instanceof Error ? error.message : "방송 생성 실패";
      return errors.internal(message);
    }
  }
);
