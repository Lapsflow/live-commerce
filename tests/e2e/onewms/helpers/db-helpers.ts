/**
 * Database Helper Utilities for ONEWMS Integration Tests
 *
 * Provides Prisma client wrapper and database query helpers
 * for verifying ONEWMS data persistence in integration tests.
 *
 * IMPORTANT: Only use in Node.js test hooks (beforeAll, afterAll, etc.),
 * not in browser context.
 */

import { PrismaClient } from '@prisma/client';

// Singleton Prisma client for test environment
let prisma: PrismaClient | null = null;

/**
 * Get Prisma client instance (singleton pattern)
 *
 * @returns Prisma client instance
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['error'], // Only log errors in tests
    });
  }
  return prisma;
}

/**
 * Get total count of OnewmsStockSync records
 *
 * @returns Number of stock sync records
 */
export async function getStockSyncCount(): Promise<number> {
  const client = getPrismaClient();
  return client.onewmsStockSync.count();
}

/**
 * Get recent stock synchronization records
 *
 * @param limit - Number of records to return (default: 10)
 * @returns Array of recent stock sync records with product info
 */
export async function getRecentStockSyncs(limit: number = 10) {
  const client = getPrismaClient();
  return client.onewmsStockSync.findMany({
    orderBy: { syncedAt: 'desc' },
    take: limit,
    include: {
      product: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Get most recent stock sync timestamp
 *
 * @returns Date of most recent sync, or null if no syncs exist
 */
export async function getLastSyncTimestamp(): Promise<Date | null> {
  const client = getPrismaClient();
  const mostRecent = await client.onewmsStockSync.findFirst({
    orderBy: { syncedAt: 'desc' },
    select: { syncedAt: true },
  });

  return mostRecent?.syncedAt || null;
}

/**
 * Get total count of OnewmsOrderMapping records
 *
 * @returns Number of order mapping records
 */
export async function getOrderMappingCount(): Promise<number> {
  const client = getPrismaClient();
  return client.onewmsOrderMapping.count();
}

/**
 * Get stock sync records by status
 *
 * @param status - Sync status to filter by ('synced' | 'conflict' | 'failed' | 'resolved')
 * @param limit - Number of records to return (default: 10)
 * @returns Array of stock sync records with specified status
 */
export async function getStockSyncsByStatus(
  status: 'synced' | 'conflict' | 'failed' | 'resolved',
  limit: number = 10
) {
  const client = getPrismaClient();
  return client.onewmsStockSync.findMany({
    where: { syncStatus: status },
    orderBy: { syncedAt: 'desc' },
    take: limit,
  });
}

/**
 * Get order mappings by status
 *
 * @param status - Order sync status to filter by
 * @param limit - Number of records to return (default: 10)
 * @returns Array of order mapping records
 */
export async function getOrderMappingsByStatus(
  status: 'pending' | 'sent' | 'shipped' | 'failed' | 'manual_intervention',
  limit: number = 10
) {
  const client = getPrismaClient();
  return client.onewmsOrderMapping.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      order: {
        select: {
          orderNo: true,
          status: true,
          shippingStatus: true,
        },
      },
    },
  });
}

/**
 * Clean up test data created during integration tests
 *
 * Deletes stock sync records created in the last hour.
 * This is a safety measure to avoid deleting production data.
 *
 * @param hoursAgo - Number of hours to look back (default: 1)
 * @returns Number of records deleted
 */
export async function cleanupTestData(hoursAgo: number = 1): Promise<number> {
  const client = getPrismaClient();
  const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  const result = await client.onewmsStockSync.deleteMany({
    where: {
      syncedAt: {
        gte: cutoffDate,
      },
    },
  });

  return result.count;
}

/**
 * Disconnect Prisma client
 *
 * Should be called in test.afterAll() to clean up database connections.
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Verify database connection is working
 *
 * @returns true if connection successful, false otherwise
 */
export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Get conflict count for stock synchronization
 *
 * @returns Number of unresolved stock conflicts
 */
export async function getConflictCount(): Promise<number> {
  const client = getPrismaClient();
  return client.onewmsStockSync.count({
    where: { syncStatus: 'conflict' },
  });
}

/**
 * Get failed order count
 *
 * @returns Number of failed order synchronizations
 */
export async function getFailedOrderCount(): Promise<number> {
  const client = getPrismaClient();
  return client.onewmsOrderMapping.count({
    where: {
      OR: [
        { status: 'failed' },
        { status: 'manual_intervention' },
      ],
    },
  });
}
