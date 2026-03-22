// ===========================================
// PROCONNECT - USER CONTROLLER
// User management API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { userService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';

/**
 * Get user profile
 * GET /api/v1/users/profile
 */
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] GET /profile');
    logger.debug(`User ID: ${req.userId}`);

    const user = await userService.getUserById(req.userId!);

    logger.debug(`Profile retrieved for: ${user?.email}`);

    sendSuccess(res, 'Profile retrieved successfully', { user });
  } catch (error) {
    logger.error(`[USER] Get profile error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Update user profile
 * PATCH /api/v1/users/profile
 */
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] PATCH /profile');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Update data: ${JSON.stringify(req.body, null, 2)}`);

    const { displayName, bio, avatar, phoneNumber } = req.body;
    const user = await userService.updateProfile(req.userId!, {
      displayName,
      bio,
      avatar,
      phoneNumber,
    });

    logger.debug('Profile updated successfully');

    sendSuccess(res, 'Profile updated successfully', { user });
  } catch (error) {
    logger.error(`[USER] Update profile error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Update user settings
 * PATCH /api/v1/users/settings
 */
export const updateSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] PATCH /settings');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Settings: ${JSON.stringify(req.body, null, 2)}`);

    const user = await userService.updateSettings(req.userId!, req.body);

    logger.debug('Settings updated successfully');

    sendSuccess(res, 'Settings updated successfully', { user });
  } catch (error) {
    logger.error(`[USER] Update settings error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Update username
 * PATCH /api/v1/users/username
 */
export const updateUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] PATCH /username');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`New username: ${req.body.username}`);

    const { username } = req.body;
    const user = await userService.updateUsername(req.userId!, username);

    logger.debug(`Username updated to: ${username}`);

    sendSuccess(res, 'Username updated successfully', { user });
  } catch (error) {
    logger.error(`[USER] Update username error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Search users
 * GET /api/v1/users/search?q=query
 */
export const searchUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] GET /search');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(req.query, 'Query params');

    const { q, page = '1', limit = '20' } = req.query;
    const { users, meta } = await userService.searchUsers(
      q as string,
      req.userId!,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    logger.debug(`Found ${users.length} users for query: ${q}`);

    sendSuccess(res, 'Users retrieved successfully', { users }, meta);
  } catch (error) {
    logger.error(`[USER] Search users error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Get user by ID
 * GET /api/v1/users/:id
 */
export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] GET /:id');
    logger.debug(`Requesting User ID: ${req.userId}`);
    logger.debug(`Target User ID: ${req.params.id}`);

    const { id } = req.params;
    const user = await userService.getPublicProfile(id, req.userId);

    logger.debug(`User retrieved: ${user?.email || 'Not found'}`);

    sendSuccess(res, 'User retrieved successfully', { user });
  } catch (error) {
    logger.error(`[USER] Get user by ID error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Get user by username
 * GET /api/v1/users/username/:username
 */
export const getUserByUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] GET /username/:username');
    logger.debug(`Requesting User ID: ${req.userId}`);
    logger.debug(`Target username: ${req.params.username}`);

    const { username } = req.params;
    const user = await userService.getUserByUsername(username);
    if (!user) {
      logger.debug(`User not found for username: ${username}`);
      sendSuccess(res, 'User not found', { user: null });
      return;
    }
    const publicProfile = await userService.getPublicProfile(
      user._id.toString(),
      req.userId
    );

    logger.debug(`User found: ${publicProfile?.email}`);

    sendSuccess(res, 'User retrieved successfully', { user: publicProfile });
  } catch (error) {
    logger.error(`[USER] Get user by username error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Add FCM token
 * POST /api/v1/users/fcm-token
 */
export const addFcmToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] POST /fcm-token');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`FCM Token: ${req.body.fcmToken?.substring(0, 20)}...`);

    const { fcmToken } = req.body;
    await userService.addFcmToken(req.userId!, fcmToken);

    logger.debug('FCM token added successfully');

    sendSuccess(res, 'FCM token added successfully');
  } catch (error) {
    logger.error(`[USER] Add FCM token error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Remove FCM token
 * DELETE /api/v1/users/fcm-token
 */
export const removeFcmToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] DELETE /fcm-token');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`FCM Token: ${req.body.fcmToken?.substring(0, 20)}...`);

    const { fcmToken } = req.body;
    await userService.removeFcmToken(req.userId!, fcmToken);

    logger.debug('FCM token removed successfully');

    sendSuccess(res, 'FCM token removed successfully');
  } catch (error) {
    logger.error(`[USER] Remove FCM token error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Get online status for multiple users
 * POST /api/v1/users/online-status
 */
export const getOnlineStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] POST /online-status');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Checking status for ${req.body.userIds?.length} users`);

    const { userIds } = req.body;
    const statuses = await userService.getOnlineStatuses(userIds);

    logger.debug('Online statuses retrieved');

    sendSuccess(res, 'Online statuses retrieved successfully', {
      statuses: Object.fromEntries(statuses),
    });
  } catch (error) {
    logger.error(`[USER] Get online status error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Delete account
 * DELETE /api/v1/users/account
 */
export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[USER] DELETE /account');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug('Account deletion requested');

    await userService.deleteAccount(req.userId!);
    
    logger.debug('Account deleted successfully');

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    sendSuccess(res, 'Account deleted successfully');
  } catch (error) {
    logger.error(`[USER] Delete account error: ${(error as Error).message}`);
    next(error);
  }
};

export default {
  getProfile,
  updateProfile,
  updateSettings,
  updateUsername,
  searchUsers,
  getUserById,
  getUserByUsername,
  addFcmToken,
  removeFcmToken,
  getOnlineStatus,
  deleteAccount,
};
