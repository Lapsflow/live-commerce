// app/api/broadcasts/[id]/stats/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errors.unauthorized();

    const { id } = await params;

    // Get broadcast statistics
    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            // Note: This assumes Order model has broadcastId field
            // If not implemented yet, this will need adjustment
          },
        },
      },
    });

    if (!broadcast) {
      return errors.notFound('방송을 찾을 수 없습니다');
    }

    // TODO: Replace with actual order queries when Order-Broadcast relation exists
    // For now, returning empty stats structure
    const stats = {
      totalSales: 0,
      totalOrders: 0,
      totalQuantity: 0,
      topProducts: [],
      recentOrders: [],
    };

    return ok(stats);
  } catch (error) {
    console.error('Failed to fetch broadcast stats:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch broadcast stats';
    return errors.internal(message);
  }
}
