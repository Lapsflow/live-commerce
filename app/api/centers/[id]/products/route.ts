/**
 * GET /api/centers/[id]/products - 센터 상품 조회
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/centers/[id]/products
 * 센터에 재고가 있는 상품 목록 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    const allowedRoles = ['MASTER', 'SUB_MASTER', 'ADMIN', 'SELLER'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return errors.forbidden('센터 상품 조회 권한이 없습니다');
    }

    // Verify center exists
    const center = await prisma.center.findUnique({
      where: { id: params.id },
    });

    if (!center) {
      return errors.notFound('센터를 찾을 수 없습니다');
    }

    // Query parameters
    const { searchParams } = new URL(req.url);
    const minStock = searchParams.get('minStock'); // Filter by minimum stock
    const search = searchParams.get('search'); // Search by name or code

    // Get products with center stock
    const centerStocks = await prisma.productCenterStock.findMany({
      where: {
        centerId: params.id,
        ...(minStock ? { stock: { gte: parseInt(minStock) } } : {}),
        product: search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
              ],
            }
          : undefined,
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            barcode: true,
            sellPrice: true,
            supplyPrice: true,
            totalStock: true,
          },
        },
      },
      orderBy: {
        product: {
          name: 'asc',
        },
      },
    });

    // Transform response
    const products = centerStocks.map((cs) => ({
      ...cs.product,
      centerStock: cs.stock,
      location: cs.location,
    }));

    return ok({
      center: {
        id: center.id,
        code: center.code,
        name: center.name,
      },
      products,
      count: products.length,
    });
  } catch (error) {
    console.error('Failed to get center products:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get center products';
    return errors.internal(message);
  }
}
