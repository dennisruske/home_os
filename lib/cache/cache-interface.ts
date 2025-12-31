/**
 * Cache interface for dependency injection and testability.
 * Implementations can use Redis, in-memory cache, or other caching solutions.
 */
export interface Cache {
  /**
   * Get a value from the cache.
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in the cache.
   * @param key - Cache key
   * @param value - Value to cache (will be JSON serialized)
   * @param ttl - Optional TTL in seconds (default: 5 minutes)
   */
  set(key: string, value: any, ttl?: number): Promise<void>;

  /**
   * Delete a value from the cache.
   * @param key - Cache key to delete
   */
  del(key: string): Promise<void>;

  /**
   * Invalidate all keys matching a pattern.
   * @param pattern - Pattern to match (e.g., "energy:aggregated:*")
   */
  invalidatePattern(pattern: string): Promise<void>;
}

