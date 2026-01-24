// ===========================================
// PROCONNECT - USER SERVICE
// User management business logic
// ===========================================

import { Types } from 'mongoose';
import { User } from '../models';
import { redis } from '../config/redis';
import { IUser, IUserSettings, RedisKeys, IPaginationMeta } from '../types';
import { NotFoundError, ConflictError } from '../utils/errors';
import { generatePaginationMeta, parsePaginationQuery, sanitizeUser } from '../utils/helpers';

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<IUser> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<IUser | null> => {
  return User.findOne({ email: email.toLowerCase() });
};

/**
 * Get user by username
 */
export const getUserByUsername = async (username: string): Promise<IUser | null> => {
  return User.findOne({ username: username.toLowerCase() });
};

/**
 * Update user profile
 */
export const updateProfile = async (
  userId: string,
  updates: Partial<Pick<IUser, 'displayName' | 'bio' | 'avatar' | 'phoneNumber'>>
): Promise<IUser> => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
};

/**
 * Update user settings
 */
export const updateSettings = async (
  userId: string,
  settings: Partial<IUserSettings>
): Promise<IUser> => {
  const updateFields: Record<string, any> = {};

  if (settings.notifications) {
    Object.entries(settings.notifications).forEach(([key, value]) => {
      updateFields[`settings.notifications.${key}`] = value;
    });
  }

  if (settings.privacy) {
    Object.entries(settings.privacy).forEach(([key, value]) => {
      updateFields[`settings.privacy.${key}`] = value;
    });
  }

  if (settings.theme) {
    updateFields['settings.theme'] = settings.theme;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updateFields },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
};

/**
 * Update username
 */
export const updateUsername = async (
  userId: string,
  newUsername: string
): Promise<IUser> => {
  // Check if username is taken
  const existingUser = await User.findOne({
    username: newUsername.toLowerCase(),
    _id: { $ne: userId },
  });

  if (existingUser) {
    throw new ConflictError('Username already taken');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { username: newUsername.toLowerCase() },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
};

/**
 * Search users
 */
export const searchUsers = async (
  query: string,
  excludeUserId?: string,
  page = 1,
  limit = 20
): Promise<{ users: IUser[]; meta: IPaginationMeta }> => {
  const searchRegex = new RegExp(query, 'i');

  const filter: Record<string, any> = {
    status: 'active',
    $or: [
      { username: searchRegex },
      { displayName: searchRegex },
      { email: searchRegex },
    ],
  };

  if (excludeUserId) {
    filter._id = { $ne: new Types.ObjectId(excludeUserId) };
  }

  const total = await User.countDocuments(filter);
  const { skip, sort } = parsePaginationQuery({ page, limit });

  const users = await User.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select('-password');

  return {
    users,
    meta: generatePaginationMeta(total, page, limit),
  };
};

/**
 * Add FCM token for push notifications
 */
export const addFcmToken = async (
  userId: string,
  fcmToken: string
): Promise<void> => {
  // Remove token from any other user
  await User.updateMany(
    { fcmTokens: fcmToken },
    { $pull: { fcmTokens: fcmToken } }
  );

  // Add to current user
  await User.findByIdAndUpdate(userId, {
    $addToSet: { fcmTokens: fcmToken },
  });
};

/**
 * Remove FCM token
 */
export const removeFcmToken = async (
  userId: string,
  fcmToken: string
): Promise<void> => {
  await User.findByIdAndUpdate(userId, {
    $pull: { fcmTokens: fcmToken },
  });
};

/**
 * Update user online status
 */
export const updateOnlineStatus = async (
  userId: string,
  isOnline: boolean
): Promise<void> => {
  const updates: Record<string, any> = {
    isOnline,
    lastSeen: new Date(),
  };

  await User.findByIdAndUpdate(userId, updates);

  // Update Redis
  if (isOnline) {
    await redis.set(`${RedisKeys.USER_ONLINE}${userId}`, '1');
  } else {
    await redis.del(`${RedisKeys.USER_ONLINE}${userId}`);
    await redis.set(
      `${RedisKeys.USER_ONLINE}${userId}:lastSeen`,
      new Date().toISOString()
    );
  }
};

/**
 * Get online status for multiple users
 */
export const getOnlineStatuses = async (
  userIds: string[]
): Promise<Map<string, { isOnline: boolean; lastSeen: Date }>> => {
  const results = new Map<string, { isOnline: boolean; lastSeen: Date }>();

  for (const userId of userIds) {
    const isOnline = await redis.get(`${RedisKeys.USER_ONLINE}${userId}`);
    let lastSeen = new Date();

    if (!isOnline) {
      const lastSeenStr = await redis.get(`${RedisKeys.USER_ONLINE}${userId}:lastSeen`);
      if (lastSeenStr) {
        lastSeen = new Date(lastSeenStr);
      } else {
        // Fallback to database
        const user = await User.findById(userId).select('lastSeen');
        if (user) {
          lastSeen = user.lastSeen;
        }
      }
    }

    results.set(userId, { isOnline: !!isOnline, lastSeen });
  }

  return results;
};

/**
 * Check if user exists
 */
export const userExists = async (userId: string): Promise<boolean> => {
  const count = await User.countDocuments({ _id: userId, status: 'active' });
  return count > 0;
};

/**
 * Get user public profile
 */
export const getPublicProfile = async (
  userId: string,
  viewerId?: string
): Promise<Partial<IUser>> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Apply privacy settings
  const publicProfile: Partial<IUser> = {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    isOnline: user.isOnline,
  };

  // Check privacy settings for avatar
  if (user.settings.privacy.profilePhoto === 'everyone') {
    publicProfile.avatar = user.avatar;
  }

  // Check privacy settings for last seen
  if (user.settings.privacy.lastSeen === 'everyone') {
    publicProfile.lastSeen = user.lastSeen;
  }

  return sanitizeUser(publicProfile);
};

/**
 * Delete user account
 */
export const deleteAccount = async (userId: string): Promise<void> => {
  await User.findByIdAndUpdate(userId, {
    status: 'inactive',
    email: `deleted_${userId}@proconnect.local`,
    username: `deleted_${userId}`,
    displayName: 'Deleted User',
    avatar: null,
    bio: '',
    phoneNumber: null,
    fcmTokens: [],
    isOnline: false,
  });

  // Clear Redis data
  const keys = await redis.keys(`*${userId}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

/**
 * Get users by IDs
 */
export const getUsersByIds = async (
  userIds: string[]
): Promise<IUser[]> => {
  const objectIds = userIds.map((id) => new Types.ObjectId(id));
  return User.find({ _id: { $in: objectIds }, status: 'active' });
};

export default {
  getUserById,
  getUserByEmail,
  getUserByUsername,
  updateProfile,
  updateSettings,
  updateUsername,
  searchUsers,
  addFcmToken,
  removeFcmToken,
  updateOnlineStatus,
  getOnlineStatuses,
  userExists,
  getPublicProfile,
  deleteAccount,
  getUsersByIds,
};
