/**
 * ONEWMS-FMS API Client Library
 *
 * @example
 * ```typescript
 * // Configure the client
 * import { setOnewmsConfig, createOnewmsClient } from '@/lib/onewms';
 *
 * setOnewmsConfig({
 *   partnerKey: 'your-partner-key',
 *   domainKey: 'your-domain-key',
 * });
 *
 * // Create client instance
 * const client = createOnewmsClient();
 *
 * // Get order info
 * const order = await client.getOrderInfo('ORDER-123');
 *
 * // Create order
 * await client.createOrder({
 *   order_no: 'ORDER-123',
 *   order_date: '2026-04-09',
 *   recipient_name: 'John Doe',
 *   recipient_phone: '010-1234-5678',
 *   recipient_address: 'Seoul, Korea',
 *   products: [
 *     { product_code: 'PROD-001', quantity: 2 }
 *   ]
 * });
 *
 * // Get stock info
 * const stock = await client.getStockInfo('PROD-001');
 * console.log(`Available: ${stock.available_qty}`);
 * ```
 */

// Export types
export * from './types';

// Export config
export { setOnewmsConfig, getOnewmsConfig, OnewmsConfigManager } from './config';

// Export client
export { OnewmsClient, createOnewmsClient } from './client';

// Re-export for convenience
export { OrderStatus, CsStatus, HoldStatus } from './types';
