import type { Cache } from './cache-interface';
import { createClient } from 'redis';

const DEFAULT_TTL = parseInt(process.env.REDIS_CACHE_TTL || '300', 10); // 5 minutes default

/**
 * Redis implementation of the Cache interface.
 * Provides caching functionality using Redis for distributed caching.
 */
export class RedisCache implements Cache {
  constructor(private client: ReturnType<typeof createClient>) {}

  /**
   * Get a value from Redis cache.
   * @param key - Cache key
   * @returns Cached value (deserialized from JSON) or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Redis cache get error for key ${key}:`, error);
      return null; // Return null on error to allow fallback to database
    }
  }

  /**
   * Set a value in Redis cache.
   * @param key - Cache key
   * @param value - Value to cache (will be JSON serialized)
   * @param ttl - Optional TTL in seconds (default: 5 minutes)
   */
  async set(key: string, value: any, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl, serialized);
    } catch (error) {
      console.error(`Redis cache set error for key ${key}:`, error);
      // Don't throw - caching failures shouldn't break the application
    }
  }

  /**
   * Delete a value from Redis cache.
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Redis cache del error for key ${key}:`, error);
      // Don't throw - caching failures shouldn't break the application
    }
  }

  /**
   * Invalidate all keys matching a pattern using SCAN.
   * @param pattern - Pattern to match (e.g., "energy:aggregated:*")
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Use SCAN to find all keys matching the pattern
      const keys: string[] = [];
      let cursor = 0;

      do {
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      // Delete all matching keys
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error(`Redis cache invalidatePattern error for pattern ${pattern}:`, error);
      // Don't throw - caching failures shouldn't break the application
    }
  }
}

/**
 * Factory function to create a RedisCache instance.
 * @param client - Redis client instance (from getRedisClient())
 * @returns RedisCache instance
 */
export function createRedisCache(client: ReturnType<typeof createClient>): RedisCache {
  return new RedisCache(client);
}

