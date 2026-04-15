/**
 * Naver Shopping API Configuration
 */

import { NaverConfig } from './types';

export function getNaverConfig(): NaverConfig {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Naver API credentials not configured. Set NAVER_CLIENT_ID and NAVER_CLIENT_SECRET environment variables.'
    );
  }

  return {
    clientId,
    clientSecret,
    apiUrl: 'https://openapi.naver.com/v1/search/shop.json',
  };
}
