import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * PUT /api/broadcasts/:id/start
 *
 * 방송 시작
 * - 상태를 SCHEDULED → LIVE로 변경
 * - startedAt 타임스탬프 기록
 * - centerId 연결 (센터 기반 상품 로드용)
 *
 * 권한: MASTER, SUB_MASTER, ADMIN, SELLER
 */
const startBroadcastHandler = async (req: NextRequest) => {
  try {
    // URL에서 broadcastId 추출
    const broadcastId = req.url.split("/").filter(s => s).slice(-2)[0];
    if (!broadcastId) {
      return errors.badRequest("Broadcast ID가 필요합니다");
    }

    // Request body에서 centerId 추출 (optional)
    let centerId: string | undefined;
    try {
      const body = await req.json();
      centerId = body.centerId;
    } catch {
      // Body가 없으면 무시 (이전 버전 호환성)
    }

    // 방송이 존재하는지 확인
    const existing = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!existing) {
      return errors.notFound("broadcast");
    }

    // 이미 시작된 방송인지 확인
    if (existing.status === "LIVE") {
      return errors.badRequest("이미 진행 중인 방송입니다");
    }

    if (existing.status === "ENDED") {
      return errors.badRequest("종료된 방송은 다시 시작할 수 없습니다");
    }

    if (existing.status === "CANCELED") {
      return errors.badRequest("취소된 방송은 시작할 수 없습니다");
    }

    // centerId가 제공되면 센터 존재 여부 확인
    if (centerId) {
      const center = await prisma.center.findUnique({
        where: { id: centerId },
      });

      if (!center) {
        return errors.notFound("센터를 찾을 수 없습니다");
      }

      if (!center.isActive) {
        return errors.badRequest("비활성화된 센터입니다");
      }
    }

    // 방송 시작 (centerId 포함)
    const updated = await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: "LIVE",
        startedAt: new Date(),
        centerId: centerId || existing.centerId, // 새 centerId 또는 기존 유지
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        center: {
          select: {
            id: true,
            code: true,
            name: true,
            regionName: true,
          },
        },
      },
    });

    return ok(updated);
  } catch (err: any) {
    return errors.internal(err.message);
  }
};

export const PUT = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  startBroadcastHandler
);

// POST alias for Phase 4 compatibility
export const POST = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  startBroadcastHandler
);
