/**
 * GET /api/centers/[id] - 센터 상세 조회
 * PUT /api/centers/[id] - 센터 수정
 * DELETE /api/centers/[id] - 센터 삭제
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import {
  getCenterById,
  updateCenter,
  deactivateCenter,
  deleteCenter,
  type UpdateCenterInput,
} from '@/lib/services/center/centerService';
import { prisma } from '@/lib/db/prisma';
import { logAudit } from '@/lib/services/audit';

/**
 * GET /api/centers/[id]
 * 센터 상세 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    const { id } = await params;

    const allowedRoles = ['MASTER', 'SUB_MASTER'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return errors.forbidden('센터 조회 권한이 없습니다');
    }

    const { searchParams } = new URL(req.url);
    const includeStats = searchParams.get('includeStats') === 'true';

    const center = await getCenterById(id, includeStats);

    if (!center) {
      return errors.notFound('센터를 찾을 수 없습니다');
    }

    return ok({ center });
  } catch (error) {
    console.error('Failed to get center:', error);
    const message = error instanceof Error ? error.message : 'Failed to get center';
    return errors.internal(message);
  }
}

/**
 * PUT /api/centers/[id]
 * 센터 수정 (MASTER만 가능)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    const { id } = await params;

    if (session.user?.role !== 'MASTER') {
      return errors.forbidden('센터 수정 권한이 없습니다. MASTER 권한이 필요합니다.');
    }

    const body = await req.json();

    const input: UpdateCenterInput = {
      name: body.name,
      representative: body.representative,
      representativePhone: body.representativePhone,
      address: body.address,
      addressDetail: body.addressDetail,
      businessNo: body.businessNo,
      contractDate: body.contractDate ? new Date(body.contractDate) : undefined,
      contractDocument: body.contractDocument,
      isActive: body.isActive,
    };

    // Remove undefined values
    Object.keys(input).forEach(
      (key) =>
        input[key as keyof UpdateCenterInput] === undefined &&
        delete input[key as keyof UpdateCenterInput]
    );

    const center = await updateCenter(id, input);

    logAudit({
      userId: (session.user as any).userId,
      userRole: session.user?.role as any,
      userName: session.user?.name ?? undefined,
      action: 'UPDATE',
      entityType: 'Center',
      entityId: id,
      entityName: center.name,
      after: input as Record<string, unknown>,
      description: `센터 수정: ${center.name}`,
      request: req,
    });

    return ok({
      center,
      message: '센터 정보가 업데이트되었습니다',
    });
  } catch (error) {
    console.error('Failed to update center:', error);
    const message = error instanceof Error ? error.message : 'Failed to update center';

    if (message.includes('not found')) {
      return errors.notFound(message);
    }

    return errors.internal(message);
  }
}

/**
 * DELETE /api/centers/[id]
 *
 * PDF §9 "(a) 비활성화 + (b) 삭제 두 버튼 모두 제공" 의 (b) 삭제.
 * - 영구 삭제 (hard delete) — cascade/SetNull 자동 실행
 * - 비활성화(soft delete) 가 필요하면 PUT { isActive: false } 사용
 *
 * Center 관계 (schema.prisma):
 *   - ProductCenterStock  → Cascade (재고 매핑 함께 삭제)
 *   - User / Order / Broadcast / ScanLog  → SetNull (이력 보존)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    const { id } = await params;

    if (session.user?.role !== 'MASTER') {
      return errors.forbidden('센터 삭제 권한이 없습니다. MASTER 권한이 필요합니다.');
    }

    // 삭제 전 존재 확인 + 메타 보존
    const existing = await prisma.center.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, isActive: true },
    });
    if (!existing) {
      return errors.notFound('센터를 찾을 수 없습니다');
    }

    // 삭제 전 cascade/setNull 카운트 (감사 로그 메타)
    const [productStockCount, userCount, orderCount, broadcastCount, scanLogCount] =
      await Promise.all([
        prisma.productCenterStock.count({ where: { centerId: id } }),
        prisma.user.count({ where: { centerId: id } }),
        prisma.order.count({ where: { processingCenterId: id } }),
        prisma.broadcast.count({ where: { centerId: id } }),
        prisma.scanLog.count({ where: { centerId: id } }),
      ]);

    // Hard delete (cascade/SetNull Prisma 가 자동 실행)
    await deleteCenter(id);

    logAudit({
      userId: (session.user as { userId?: string }).userId,
      userRole: session.user?.role,
      userName: session.user?.name ?? undefined,
      action: 'DELETE',
      entityType: 'Center',
      entityId: id,
      entityName: existing.name,
      before: { name: existing.name, code: existing.code, isActive: existing.isActive },
      metadata: {
        cascade: { productCenterStocks: productStockCount },
        setNull: { users: userCount, orders: orderCount, broadcasts: broadcastCount, scanLogs: scanLogCount },
      } as Record<string, unknown>,
      description:
        `센터 삭제: ${existing.name} (${existing.code}) — 재고매핑 ${productStockCount}건 함께 삭제, ` +
        `사용자 ${userCount}/발주 ${orderCount}/방송 ${broadcastCount}/스캔 ${scanLogCount}건 이력 보존`,
      request: req,
    });

    return ok({
      message: '센터가 영구 삭제되었습니다',
      deleted: { id: existing.id, name: existing.name, code: existing.code },
      cascade: { productCenterStocks: productStockCount },
      setNull: { users: userCount, orders: orderCount, broadcasts: broadcastCount, scanLogs: scanLogCount },
    });
  } catch (error) {
    console.error('Failed to delete center:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to delete center';

    if (message.includes('not found') || message.includes('Record to delete does not exist')) {
      return errors.notFound('센터를 찾을 수 없습니다');
    }

    return errors.internal(message);
  }
}

/**
 * @deprecated 비활성화는 PUT { isActive: false } 사용. 호환성 유지를 위해 함수 보존.
 */
void deactivateCenter; // unused import guard
