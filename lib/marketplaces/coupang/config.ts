/**
 * Coupang Partners API Configuration
 */

import { CoupangConfig } from './types';

export function getCoupangConfig(): CoupangConfig {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error(
      'Coupang API credentials not configured. Set COUPANG_ACCESS_KEY and COUPANG_SECRET_KEY environment variables.'
    );
  }

  return {
    accessKey,
    secretKey,
    apiUrl: 'https://api-gateway.coupang.com',
  };
}
