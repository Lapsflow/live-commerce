/**
 * Test Data Fixtures
 * Provides database query helpers for fetching real test IDs
 */

import { prisma } from '@/lib/db/prisma';

/**
 * Get first CENTER product ID for testing
 */
export async function getFirstProductId(): Promise<string> {
  try {
    const product = await prisma.product.findFirst({
      where: { productType: 'CENTER' },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return product?.id || '';
  } catch (error) {
    console.error('Failed to get product ID:', error);
    return '';
  }
}

/**
 * Get first WMS/HEADQUARTERS product ID for testing price lock
 */
export async function getWmsProductId(): Promise<string> {
  try {
    const product = await prisma.product.findFirst({
      where: { productType: 'HEADQUARTERS' },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return product?.id || '';
  } catch (error) {
    console.error('Failed to get WMS product ID:', error);
    return '';
  }
}

/**
 * Get first order ID for testing
 */
export async function getFirstOrderId(): Promise<string> {
  try {
    const order = await prisma.order.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return order?.id || '';
  } catch (error) {
    console.error('Failed to get order ID:', error);
    return '';
  }
}

/**
 * Get first broadcast ID for testing
 */
export async function getFirstBroadcastId(): Promise<string> {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return broadcast?.id || '';
  } catch (error) {
    console.error('Failed to get broadcast ID:', error);
    return '';
  }
}

/**
 * Get first center ID for testing
 */
export async function getFirstCenterId(): Promise<string> {
  try {
    const center = await prisma.center.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return center?.id || '';
  } catch (error) {
    console.error('Failed to get center ID:', error);
    return '';
  }
}

/**
 * Get product with barcode for testing barcode features
 */
export async function getProductWithBarcode(): Promise<{ id: string; barcode: string; name: string } | null> {
  try {
    const product = await prisma.product.findFirst({
      where: {
        barcode: { not: '' },
      },
      select: { id: true, barcode: true, name: true },
      orderBy: { createdAt: 'desc' },
    });
    return product;
  } catch (error) {
    console.error('Failed to get product with barcode:', error);
    return null;
  }
}

/**
 * Cleanup: Disconnect Prisma client
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
