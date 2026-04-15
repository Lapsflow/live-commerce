/**
 * Redis Client with Upstash
 * Upstash provides serverless Redis compatible with Vercel
 */

import { Redis } from '@upstash/redis';

/**
 * Redis singleton instance
 */
let redis: Redis | null = null;

/**
 * Get Redis client
 */
export function getRedisClient(): Redis {
  if (redis) {
    return redis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Redis credentials not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
    );
  }

  redis = new Redis({
    url,
    token,
  });

  return redis;
}

/**
 * Cache key prefixes
 */
export const CACHE_KEYS = {
  // Pricing cache keys (TTL: 6 hours)
  NAVER_PRICING: (barcode: string) => `pricing:barcode:${barcode}:naver`,
  COUPANG_PRICING: (barcode: string) => `pricing:barcode:${barcode}:coupang`,
  UNIFIED_PRICING: (barcode: string) => `pricing:barcode:${barcode}:unified`,

  // Product search cache (TTL: 1 hour)
  NAVER_SEARCH: (query: string) => `search:naver:${query}`,
  COUPANG_SEARCH: (query: string) => `search:coupang:${query}`,
} as const;

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  PRICING: 6 * 60 * 60, // 6 hours
  SEARCH: 1 * 60 * 60, // 1 hour
  SHORT: 5 * 60, // 5 minutes
} as const;

/**
 * Get cached value
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const value = await client.get<T>(key);
    return value;
  } catch (error) {
    console.error(`Redis GET error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = CACHE_TTL.PRICING
): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Redis SET error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`Redis DEL error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete multiple cached values by pattern
 */
export async function deleteCachedByPattern(pattern: string): Promise<number> {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await client.del(...keys);
    return keys.length;
  } catch (error) {
    console.error(`Redis DEL pattern error for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Check if key exists in cache
 */
export async function existsInCache(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    console.error(`Redis EXISTS error for key ${key}:`, error);
    return false;
  }
}

/**
 * Get TTL of cached key (in seconds, -1 if no expiry, -2 if not exists)
 */
export async function getTTL(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    return await client.ttl(key);
  } catch (error) {
    console.error(`Redis TTL error for key ${key}:`, error);
    return -2;
  }
}

/**
 * Increment counter
 */
export async function incrementCounter(key: string, ttl?: number): Promise<number> {
  try {
    const client = getRedisClient();
    const value = await client.incr(key);

    if (ttl && value === 1) {
      // Set TTL only for the first increment
      await client.expire(key, ttl);
    }

    return value;
  } catch (error) {
    console.error(`Redis INCR error for key ${key}:`, error);
    return 0;
  }
}

/**
 * Get counter value
 */
export async function getCounter(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    const value = await client.get<number>(key);
    return value || 0;
  } catch (error) {
    console.error(`Redis GET counter error for key ${key}:`, error);
    return 0;
  }
}
