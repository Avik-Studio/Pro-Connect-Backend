// ===========================================
// PROCONNECT - AUTHENTICATION MIDDLEWARE
// JWT verification and user authentication
// ===========================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config';
import { User } from '../models';
import { redis } from '../config/redis';
import { ITokenPayload, RedisKeys } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Verify JWT access token and attach user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header or cookie
    let token: string | undefined;

    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Fallback to cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }

    // Verify token
    const decoded = jwt.verify(token, appConfig.jwt.accessSecret) as ITokenPayload;

    if (decoded.type !== 'access') {
      throw new UnauthorizedError('Invalid token type');
    }

    // Check if token is blacklisted in Redis
    const isBlacklisted = await redis.get(`${RedisKeys.REFRESH_TOKEN}blacklist:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new ForbiddenError('Account is inactive or banned');
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token has expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};

/**
 * Optional authentication - attach user if token present, but don't require it
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, appConfig.jwt.accessSecret) as ITokenPayload;
        
        if (decoded.type === 'access') {
          const user = await User.findById(decoded.userId).select('-password');
          if (user && user.status === 'active') {
            req.user = user;
            req.userId = user._id.toString();
          }
        }
      } catch {
        // Token invalid, but that's ok for optional auth
        logger.debug('Optional auth: invalid token');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based access control middleware
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }

    // Verify token
    const decoded = jwt.verify(refreshToken, appConfig.jwt.refreshSecret) as ITokenPayload;

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Invalid token type');
    }

    // Attach decoded info to request
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Refresh token has expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid refresh token'));
    } else {
      next(error);
    }
  }
};

/**
 * Extract device info from request
 */
export const extractDeviceInfo = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const deviceId = req.headers['x-device-id'] as string || 'unknown';
  const deviceType = (req.headers['x-device-type'] as string) || 'web';
  const deviceName = req.headers['x-device-name'] as string;

  req.deviceInfo = {
    deviceId,
    deviceType: deviceType as 'ios' | 'android' | 'web' | 'desktop',
    deviceName,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  next();
};

export default {
  authenticate,
  optionalAuth,
  authorize,
  verifyRefreshToken,
  extractDeviceInfo,
};
