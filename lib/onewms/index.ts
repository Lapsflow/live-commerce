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
 * // Get order info (requires date range)
 * const orders = await client.getOrderInfo({
 *   date_type: 'order_date',
 *   start_date: '2026-04-09',
 *   end_date: '2026-04-09',
 * });
 *
 * // Get product list (paginated)
 * const { data: products, total } = await client.getProductList(1, 100);
 *
 * // Get reference data
 * const carriers = await client.getEtcInfo('trans');
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
