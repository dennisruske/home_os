import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

// Redis Client singleton (needed for Next.js hot reload)
const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createClient> | undefined;
};

/**
 * Gets the Redis client singleton instance.
 * This function provides controlled access to the Redis client for dependency injection.
 * @returns RedisClientType instance
 */
export function getRedisClient(): ReturnType<typeof createClient> {
  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error(
      'REDIS_URL environment variable is not set. ' +
      'Please set REDIS_URL to your Redis connection URL (e.g., redis://localhost:6379)'
    );
  }

  const client = createClient({
    url: redisUrl,
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  // Connect in background - connection is lazy
  client.connect().catch((err) => {
    console.error('Failed to connect to Redis:', err);
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForRedis.redis = client;
  }

  return client;
}

