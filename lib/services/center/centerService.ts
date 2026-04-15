/**
 * Center Service
 * Handles center CRUD operations and center-related business logic
 */

import { prisma } from '@/lib/db/prisma';
import type { Center, Prisma } from '@/lib/generated/prisma/client';

export interface CreateCenterInput {
  code: string; // Format: "01-4213" (regionCode-phoneCode)
  name: string;
  regionCode: string; // "01" ~ "17"
  regionName: string; // 서울특별시, 경기도, etc.
  representative: string;
  representativePhone: string;
  address: string;
  addressDetail?: string;
  businessNo?: string;
  contractDate?: Date;
  contractDocument?: string;
}

export interface UpdateCenterInput {
  name?: string;
  representative?: string;
  representativePhone?: string;
  address?: string;
  addressDetail?: string;
  businessNo?: string;
  contractDate?: Date;
  contractDocument?: string;
  isActive?: boolean;
}

export interface CenterWithStats extends Center {
  _count: {
    users: number;
    centerStocks: number;
    orders: number;
    broadcasts: number;
  };
}

/**
 * Get all centers with optional filters
 */
export async function getCenters(params?: {
  regionCode?: string;
  isActive?: boolean;
  includeStats?: boolean;
}): Promise<Center[] | CenterWithStats[]> {
  const where: Prisma.CenterWhereInput = {};

  if (params?.regionCode) {
    where.regionCode = params.regionCode;
  }

  if (params?.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  const centers = await prisma.center.findMany({
    where,
    include: params?.includeStats
      ? {
          _count: {
            select: {
              users: true,
              centerStocks: true,
              orders: true,
              broadcasts: true,
            },
          },
        }
      : undefined,
    orderBy: [{ regionCode: 'asc' }, { createdAt: 'desc' }],
  });

  return centers;
}

/**
 * Get a single center by ID
 */
export async function getCenterById(
  id: string,
  includeStats = false
): Promise<Center | CenterWithStats | null> {
  return await prisma.center.findUnique({
    where: { id },
    include: includeStats
      ? {
          _count: {
            select: {
              users: true,
              centerStocks: true,
              orders: true,
              broadcasts: true,
            },
          },
        }
      : undefined,
  });
}

/**
 * Get a center by code
 */
export async function getCenterByCode(code: string): Promise<Center | null> {
  return await prisma.center.findUnique({
    where: { code },
  });
}

/**
 * Create a new center
 */
export async function createCenter(
  input: CreateCenterInput
): Promise<Center> {
  // Validate code format (regionCode-phoneCode)
  const codePattern = /^\d{2}-\d{4}$/;
  if (!codePattern.test(input.code)) {
    throw new Error(
      'Invalid center code format. Expected: "01-4213" (regionCode-phoneCode)'
    );
  }

  // Check if code already exists
  const existing = await getCenterByCode(input.code);
  if (existing) {
    throw new Error(`Center with code ${input.code} already exists`);
  }

  return await prisma.center.create({
    data: {
      code: input.code,
      name: input.name,
      regionCode: input.regionCode,
      regionName: input.regionName,
      representative: input.representative,
      representativePhone: input.representativePhone,
      address: input.address,
      addressDetail: input.addressDetail,
      businessNo: input.businessNo,
      contractDate: input.contractDate,
      contractDocument: input.contractDocument,
    },
  });
}

/**
 * Update an existing center
 */
export async function updateCenter(
  id: string,
  input: UpdateCenterInput
): Promise<Center> {
  // Verify center exists
  const center = await getCenterById(id);
  if (!center) {
    throw new Error(`Center with id ${id} not found`);
  }

  return await prisma.center.update({
    where: { id },
    data: input,
  });
}

/**
 * Soft delete a center (set isActive = false)
 */
export async function deactivateCenter(id: string): Promise<Center> {
  return await updateCenter(id, { isActive: false });
}

/**
 * Hard delete a center (permanent deletion)
 * WARNING: This will cascade delete all related data
 */
export async function deleteCenter(id: string): Promise<Center> {
  return await prisma.center.delete({
    where: { id },
  });
}

/**
 * Get center statistics
 */
export async function getCenterStats(centerId: string) {
  const center = await prisma.center.findUnique({
    where: { id: centerId },
    include: {
      _count: {
        select: {
          users: true,
          centerStocks: true,
          orders: true,
          broadcasts: true,
        },
      },
    },
  });

  if (!center) {
    throw new Error(`Center with id ${centerId} not found`);
  }

  // Get additional stats
  const [totalStockQuantity, totalRevenue, activeBroadcasts] =
    await Promise.all([
      // Total stock quantity across all products
      prisma.productCenterStock.aggregate({
        where: { centerId },
        _sum: { stock: true },
      }),

      // Total revenue from orders
      prisma.order.aggregate({
        where: {
          processingCenterId: centerId,
          paymentStatus: 'PAID',
        },
        _sum: { totalAmount: true },
      }),

      // Active broadcasts count
      prisma.broadcast.count({
        where: {
          centerId,
          status: 'LIVE',
        },
      }),
    ]);

  return {
    center,
    stats: {
      userCount: center._count.users,
      productCount: center._count.centerStocks,
      orderCount: center._count.orders,
      broadcastCount: center._count.broadcasts,
      totalStockQuantity: totalStockQuantity._sum.stock || 0,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      activeBroadcasts,
    },
  };
}

/**
 * Validate center code format and availability
 */
export async function validateCenterCode(code: string): Promise<{
  valid: boolean;
  available: boolean;
  message: string;
}> {
  const codePattern = /^\d{2}-\d{4}$/;

  if (!codePattern.test(code)) {
    return {
      valid: false,
      available: false,
      message:
        'Invalid format. Expected: "01-4213" (2-digit region code + 4-digit phone code)',
    };
  }

  const existing = await getCenterByCode(code);
  if (existing) {
    return {
      valid: true,
      available: false,
      message: `Center code ${code} is already in use`,
    };
  }

  return {
    valid: true,
    available: true,
    message: 'Center code is valid and available',
  };
}
