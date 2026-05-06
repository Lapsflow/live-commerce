/**
 * POST /api/products/auto-created/:id/review
 * 자동 등록 상품 검토 완료 처리 (MASTER/SUB_MASTER 전용)
 */

import { NextRequest } from 'next/server';
import { withRole, AuthUser } from '@/lib/api/middleware';
import { ok, errors } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { logAudit } from '@/lib/services/audit';

export const POST = withRole(
  ['MASTER', 'SUB_MASTER'],
  async (req: NextRequest, user: AuthUser, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, autoCreated: true, reviewedAt: true },
    });

    if (!product) {
      return errors.notFound('상품');
    }

    if (!product.autoCreated) {
      return errors.badRequest('자동 등록 상품이 아닙니다');
    }

    if (product.reviewedAt) {
      return errors.badRequest('이미 검토 완료된 상품입니다');
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewedBy: user.userId,
      },
    });

    logAudit({
      userId: user.userId,
      userRole: user.role,
      userName: user.name,
      action: 'UPDATE',
      entityType: 'Product',
      entityId: id,
      entityName: product.name,
      description: `자동 등록 상품 검토 완료: ${product.name}`,
    });

    return ok({ id: updated.id, reviewedAt: updated.reviewedAt });
  }
);
