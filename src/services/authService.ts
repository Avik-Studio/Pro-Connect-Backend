// ===========================================
// PROCONNECT - AUTH SERVICE
// Authentication business logic
// ===========================================

import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { appConfig } from '../config';
import { redis } from '../config/redis';
import { User, RefreshToken } from '../models';
import { IAuthTokens, IDeviceInfo, ITokenPayload, IUser, RedisKeys } from '../types';
import { 
  AuthenticationError, 
  ConflictError, 
  NotFoundError, 
  UnauthorizedError 
} from '../utils/errors';
import { logAuthEvent } from '../utils/logger';
import { parseTimeString } from '../utils/helpers';

/**
 * Generate access token
 */
const generateAccessToken = (user: IUser): string => {
  const payload: ITokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    type: 'access',
  };

  return jwt.sign(payload, appConfig.jwt.accessSecret as jwt.Secret, {
    expiresIn: appConfig.jwt.accessExpiry as jwt.SignOptions['expiresIn'],
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (user: IUser): string => {
  const payload: ITokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    type: 'refresh',
  };

  return jwt.sign(payload, appConfig.jwt.refreshSecret as jwt.Secret, {
    expiresIn: appConfig.jwt.refreshExpiry as jwt.SignOptions['expiresIn'],
  });
};

/**
 * Register a new user
 */
export const register = async (
  email: string,
  password: string,
  username: string,
  displayName: string,
  deviceInfo: IDeviceInfo
): Promise<{ user: IUser; tokens: IAuthTokens }> => {
  // Check if email already exists
  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw new ConflictError('Email already registered');
  }

  // Check if username already exists
  const existingUsername = await User.findOne({ username: username.toLowerCase() });
  if (existingUsername) {
    throw new ConflictError('Username already taken');
  }

  // Create user
  const user = await User.create({
    email: email.toLowerCase(),
    password,
    username: username.toLowerCase(),
    displayName,
    authProvider: 'local',
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store refresh token in database
  await (RefreshToken as any).createToken(user._id, deviceInfo);

  // Store session in Redis
  await redis.setex(
    `${RedisKeys.USER_SESSION}${user._id}:${deviceInfo.deviceId}`,
    parseTimeString(appConfig.jwt.refreshExpiry) / 1000,
    JSON.stringify({ deviceInfo, createdAt: new Date() })
  );

  logAuthEvent({
    action: 'register',
    userId: user._id.toString(),
    email: user.email,
    success: true,
    ip: deviceInfo.ipAddress,
  });

  return {
    user,
    tokens: { accessToken, refreshToken },
  };
};

/**
 * Login user with email and password
 */
export const login = async (
  email: string,
  password: string,
  deviceInfo: IDeviceInfo
): Promise<{ user: IUser; tokens: IAuthTokens }> => {
  // Find user with password
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    logAuthEvent({
      action: 'login',
      email,
      success: false,
      ip: deviceInfo.ipAddress,
      reason: 'User not found',
    });
    throw new AuthenticationError('Invalid email or password');
  }

  // Check if account is active
  if (user.status !== 'active') {
    logAuthEvent({
      action: 'login',
      userId: user._id.toString(),
      email,
      success: false,
      ip: deviceInfo.ipAddress,
      reason: 'Account inactive',
    });
    throw new AuthenticationError('Account is inactive or banned');
  }

  // Check if using OAuth account
  if (user.authProvider !== 'local') {
    throw new AuthenticationError(`Please login with ${user.authProvider}`);
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    logAuthEvent({
      action: 'login',
      userId: user._id.toString(),
      email,
      success: false,
      ip: deviceInfo.ipAddress,
      reason: 'Invalid password',
    });
    throw new AuthenticationError('Invalid email or password');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store refresh token
  await (RefreshToken as any).createToken(user._id, deviceInfo);

  // Store session in Redis
  await redis.setex(
    `${RedisKeys.USER_SESSION}${user._id}:${deviceInfo.deviceId}`,
    parseTimeString(appConfig.jwt.refreshExpiry) / 1000,
    JSON.stringify({ deviceInfo, createdAt: new Date() })
  );

  // Update user online status
  await User.findByIdAndUpdate(user._id, {
    isOnline: true,
    lastSeen: new Date(),
  });

  logAuthEvent({
    action: 'login',
    userId: user._id.toString(),
    email: user.email,
    success: true,
    ip: deviceInfo.ipAddress,
  });

  // Remove password from response
  user.password = undefined;

  return {
    user,
    tokens: { accessToken, refreshToken },
  };
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (
  refreshToken: string,
  deviceInfo: IDeviceInfo
): Promise<IAuthTokens> => {
  // Verify refresh token
  let decoded: ITokenPayload;
  try {
    decoded = jwt.verify(refreshToken, appConfig.jwt.refreshSecret) as ITokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check if token exists and is valid
  const storedToken = await (RefreshToken as any).verifyToken(refreshToken);
  if (!storedToken) {
    throw new UnauthorizedError('Refresh token not found or revoked');
  }

  // Get user
  const user = await User.findById(decoded.userId);
  if (!user || user.status !== 'active') {
    throw new UnauthorizedError('User not found or inactive');
  }

  // Rotate refresh token
  const newRefreshTokenDoc = await (RefreshToken as any).rotateToken(refreshToken);
  if (!newRefreshTokenDoc) {
    throw new UnauthorizedError('Failed to rotate refresh token');
  }

  // Generate new access token
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Update session in Redis
  await redis.setex(
    `${RedisKeys.USER_SESSION}${user._id}:${deviceInfo.deviceId}`,
    parseTimeString(appConfig.jwt.refreshExpiry) / 1000,
    JSON.stringify({ deviceInfo, createdAt: new Date() })
  );

  logAuthEvent({
    action: 'token_refresh',
    userId: user._id.toString(),
    email: user.email,
    success: true,
    ip: deviceInfo.ipAddress,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Logout user
 */
export const logout = async (
  userId: string,
  refreshToken?: string,
  deviceInfo?: IDeviceInfo,
  logoutAll = false
): Promise<void> => {
  if (logoutAll) {
    // Revoke all refresh tokens
    await (RefreshToken as any).revokeAllUserTokens(new Types.ObjectId(userId));
    
    // Delete all sessions from Redis
    const sessionKeys = await redis.keys(`${RedisKeys.USER_SESSION}${userId}:*`);
    if (sessionKeys.length > 0) {
      await redis.del(...sessionKeys);
    }
  } else if (refreshToken) {
    // Revoke specific refresh token
    await (RefreshToken as any).revokeToken(refreshToken);
    
    // Delete session from Redis
    if (deviceInfo) {
      await redis.del(`${RedisKeys.USER_SESSION}${userId}:${deviceInfo.deviceId}`);
    }
  }

  // Update user online status
  await User.findByIdAndUpdate(userId, {
    isOnline: false,
    lastSeen: new Date(),
  });

  logAuthEvent({
    action: 'logout',
    userId,
    success: true,
    ip: deviceInfo?.ipAddress,
  });
};

/**
 * Handle Google OAuth login/register
 */
export const googleOAuth = async (
  googleId: string,
  email: string,
  displayName: string,
  avatar: string | undefined,
  deviceInfo: IDeviceInfo
): Promise<{ user: IUser; tokens: IAuthTokens; isNewUser: boolean }> => {
  let user = await User.findOne({ googleId });
  let isNewUser = false;

  if (!user) {
    // Check if email exists with different auth provider
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      // Link Google account to existing user
      existingUser.googleId = googleId;
      existingUser.isEmailVerified = true;
      await existingUser.save();
      user = existingUser;
    } else {
      // Create new user
      const username = email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);
      user = await User.create({
        email: email.toLowerCase(),
        googleId,
        username,
        displayName,
        avatar,
        authProvider: 'google',
        isEmailVerified: true,
      });
      isNewUser = true;
    }
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store refresh token
  await (RefreshToken as any).createToken(user._id, deviceInfo);

  // Update online status
  await User.findByIdAndUpdate(user._id, {
    isOnline: true,
    lastSeen: new Date(),
  });

  logAuthEvent({
    action: 'oauth',
    userId: user._id.toString(),
    email: user.email,
    success: true,
    ip: deviceInfo.ipAddress,
  });

  return {
    user,
    tokens: { accessToken, refreshToken },
    isNewUser,
  };
};

/**
 * Handle Apple OAuth login/register
 */
export const appleOAuth = async (
  appleId: string,
  email: string | undefined,
  displayName: string | undefined,
  deviceInfo: IDeviceInfo
): Promise<{ user: IUser; tokens: IAuthTokens; isNewUser: boolean }> => {
  let user = await User.findOne({ appleId });
  let isNewUser = false;

  if (!user) {
    if (!email) {
      throw new AuthenticationError('Email is required for Apple sign-up');
    }

    // Check if email exists with different auth provider
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      // Link Apple account to existing user
      existingUser.appleId = appleId;
      existingUser.isEmailVerified = true;
      await existingUser.save();
      user = existingUser;
    } else {
      // Create new user
      const username = email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);
      user = await User.create({
        email: email.toLowerCase(),
        appleId,
        username,
        displayName: displayName || username,
        authProvider: 'apple',
        isEmailVerified: true,
      });
      isNewUser = true;
    }
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store refresh token
  await (RefreshToken as any).createToken(user._id, deviceInfo);

  // Update online status
  await User.findByIdAndUpdate(user._id, {
    isOnline: true,
    lastSeen: new Date(),
  });

  logAuthEvent({
    action: 'oauth',
    userId: user._id.toString(),
    email: user.email,
    success: true,
    ip: deviceInfo.ipAddress,
  });

  return {
    user,
    tokens: { accessToken, refreshToken },
    isNewUser,
  };
};

/**
 * Change password
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.authProvider !== 'local') {
    throw new AuthenticationError('Cannot change password for OAuth accounts');
  }

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AuthenticationError('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  // Revoke all other sessions
  await (RefreshToken as any).revokeAllUserTokens(new Types.ObjectId(userId));
};

/**
 * Get active sessions for a user
 */
export const getActiveSessions = async (userId: string) => {
  return (RefreshToken as any).getActiveSessions(new Types.ObjectId(userId));
};

/**
 * Revoke a specific session
 */
export const revokeSession = async (
  userId: string,
  sessionId: string
): Promise<void> => {
  await (RefreshToken as any).deleteSession(
    new Types.ObjectId(userId),
    new Types.ObjectId(sessionId)
  );
};

export default {
  register,
  login,
  refreshAccessToken,
  logout,
  googleOAuth,
  appleOAuth,
  changePassword,
  getActiveSessions,
  revokeSession,
};
