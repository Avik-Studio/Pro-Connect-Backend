// ===========================================
// PROCONNECT - REDIS CLIENT
// Redis connection for caching and real-time features
// ===========================================

import Redis from 'ioredis';
import { appConfig } from './index';
import { logger } from '../utils/logger';

// Create Redis client
const createRedisClient = (): Redis => {
  const client = new Redis({
    host: appConfig.redis.host,
    port: appConfig.redis.port,
    username: appConfig.redis.username,
    password: appConfig.redis.password,
    db: appConfig.redis.db,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error('Redis connection failed after 10 retries');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis connection retry in ${delay}ms (attempt ${times})`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  // Event handlers
  client.on('connect', () => {
    logger.info('Redis client connecting...');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  client.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
  });

  return client;
};

// Main Redis client instance
export const redis = createRedisClient();

// Subscriber client for pub/sub (separate connection required)
export const redisSub = createRedisClient();

// Publisher client for pub/sub
export const redisPub = createRedisClient();

// ===========================================
// REDIS HELPER FUNCTIONS
// ===========================================

/**
 * Set a value with optional expiry
 */
export const setCache = async (
  key: string,
  value: string | object,
  expirySeconds?: number
): Promise<void> => {
  const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
  if (expirySeconds) {
    await redis.setex(key, expirySeconds, stringValue);
  } else {
    await redis.set(key, stringValue);
  }
};

/**
 * Get a value from cache
 */
export const getCache = async <T = string>(key: string, parse = false): Promise<T | null> => {
  const value = await redis.get(key);
  if (!value) return null;
  return parse ? JSON.parse(value) : (value as T);
};

/**
 * Delete a key from cache
 */
export const deleteCache = async (key: string): Promise<void> => {
  await redis.del(key);
};

/**
 * Delete multiple keys matching a pattern
 */
export const deleteCachePattern = async (pattern: string): Promise<void> => {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

/**
 * Set hash field
 */
export const setHashField = async (
  key: string,
  field: string,
  value: string | object
): Promise<void> => {
  const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
  await redis.hset(key, field, stringValue);
};

/**
 * Get hash field
 */
export const getHashField = async <T = string>(
  key: string,
  field: string,
  parse = false
): Promise<T | null> => {
  const value = await redis.hget(key, field);
  if (!value) return null;
  return parse ? JSON.parse(value) : (value as T);
};

/**
 * Get all hash fields
 */
export const getHashAll = async <T = Record<string, string>>(key: string): Promise<T | null> => {
  const value = await redis.hgetall(key);
  if (!value || Object.keys(value).length === 0) return null;
  return value as T;
};

/**
 * Add to set
 */
export const addToSet = async (key: string, ...members: string[]): Promise<void> => {
  await redis.sadd(key, ...members);
};

/**
 * Remove from set
 */
export const removeFromSet = async (key: string, ...members: string[]): Promise<void> => {
  await redis.srem(key, ...members);
};

/**
 * Get all set members
 */
export const getSetMembers = async (key: string): Promise<string[]> => {
  return redis.smembers(key);
};

/**
 * Check if member exists in set
 */
export const isMemberOfSet = async (key: string, member: string): Promise<boolean> => {
  const result = await redis.sismember(key, member);
  return result === 1;
};

/**
 * Increment a counter
 */
export const incrementCounter = async (key: string, increment = 1): Promise<number> => {
  return redis.incrby(key, increment);
};

/**
 * Set expiry on a key
 */
export const setExpiry = async (key: string, seconds: number): Promise<void> => {
  await redis.expire(key, seconds);
};

/**
 * Check Redis health
 */
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
};

/**
 * Close Redis connections
 */
export const closeRedisConnections = async (): Promise<void> => {
  await Promise.all([
    redis.quit(),
    redisSub.quit(),
    redisPub.quit(),
  ]);
  logger.info('Redis connections closed');
};

export default redis;
