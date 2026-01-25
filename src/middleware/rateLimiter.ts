// ===========================================
// PROCONNECT - RATE LIMITING MIDDLEWARE
// Request rate limiting with Redis
// ===========================================

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { redis } from '../config/redis';
import { appConfig } from '../config';
import { TooManyRequestsError } from '../utils/errors';
import { RedisKeys } from '../types';
import { logger } from '../utils/logger';

/**
 * Redis store for rate limiting
 */
class RedisStore {
  prefix: string;
  windowMs: number;

  constructor(prefix: string, windowMs: number) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}${key}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old entries and count remaining
    await redis.zremrangebyscore(redisKey, 0, windowStart);
    await redis.zadd(redisKey, now, `${now}`);
    await redis.expire(redisKey, Math.ceil(this.windowMs / 1000));

    const totalHits = await redis.zcard(redisKey);
    const resetTime = new Date(now + this.windowMs);

    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    // Remove the most recent entry
    await redis.zpopmax(redisKey);
  }

  async resetKey(key: string): Promise<void> {
    await redis.del(`${this.prefix}${key}`);
  }
}

/**
 * Create rate limiter with custom options
 */
const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  message?: string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}) => {
  const {
    windowMs = appConfig.rateLimit.windowMs,
    max = appConfig.rateLimit.maxRequests,
    keyPrefix = RedisKeys.RATE_LIMIT,
    message = 'Too many requests, please try again later',
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
  } = options;

  const store = new RedisStore(keyPrefix, windowMs);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';

    try {
      const { totalHits, resetTime } = await store.increment(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - totalHits));
      res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

      if (totalHits > max) {
        logger.warn({
          ip: key,
          totalHits,
          limit: max,
        }, 'Rate limit exceeded');

        // If skip options enabled, decrement and continue
        if (skipFailedRequests || skipSuccessfulRequests) {
          const originalEnd = res.end.bind(res);
          res.end = function(this: Response, ...args: Parameters<Response['end']>): Response {
            if (
              (skipFailedRequests && res.statusCode >= 400) ||
              (skipSuccessfulRequests && res.statusCode < 400)
            ) {
              store.decrement(key).catch(() => {});
            }
            return originalEnd(...args);
          } as Response['end'];
        }

        res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
        throw new TooManyRequestsError(message);
      }

      next();
    } catch (error) {
      if (error instanceof TooManyRequestsError) {
        next(error);
      } else {
        // On Redis error, allow request to proceed
        logger.error('Rate limiter Redis error:', error);
        next();
      }
    }
  };
};

/**
 * General API rate limiter
 */
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyPrefix: `${RedisKeys.RATE_LIMIT}api:`,
});

/**
 * Strict rate limiter for auth endpoints
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: appConfig.isDevelopment ? 1000 : 10, // Relaxed limit for development
  keyPrefix: `${RedisKeys.RATE_LIMIT}auth:`,
  message: 'Too many authentication attempts, please try again later',
});

/**
 * Rate limiter for registration
 */
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyPrefix: `${RedisKeys.RATE_LIMIT}register:`,
  message: 'Too many registration attempts, please try again later',
});

/**
 * Rate limiter for password reset
 */
export const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyPrefix: `${RedisKeys.RATE_LIMIT}password-reset:`,
  message: 'Too many password reset attempts, please try again later',
});

/**
 * Rate limiter for file uploads
 */
export const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  keyPrefix: `${RedisKeys.RATE_LIMIT}upload:`,
  message: 'Upload limit reached, please try again later',
});

/**
 * Rate limiter for message sending
 */
export const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  keyPrefix: `${RedisKeys.RATE_LIMIT}message:`,
  message: 'Sending messages too fast, please slow down',
});

/**
 * Rate limiter for call initiation
 */
export const callLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyPrefix: `${RedisKeys.RATE_LIMIT}call:`,
  message: 'Too many call attempts, please try again later',
});

/**
 * Express-rate-limit based limiter (fallback)
 */
export const expressRateLimiter = rateLimit({
  windowMs: appConfig.rateLimit.windowMs,
  max: appConfig.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  skip: (_req) => appConfig.isDevelopment,
});

export default {
  apiLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  uploadLimiter,
  messageLimiter,
  callLimiter,
  expressRateLimiter,
  createRateLimiter,
};
