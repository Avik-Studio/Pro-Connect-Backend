// ===========================================
// PROCONNECT - NOTIFICATION SERVICE
// Push notifications with Firebase Cloud Messaging
// ===========================================

import admin from 'firebase-admin';
import { appConfig } from '../config';
import { User } from '../models';
import { INotificationPayload, IUser, IMessage, ICall } from '../types';
import { logger } from '../utils/logger';

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = (): void => {
  if (firebaseInitialized) return;

  if (
    appConfig.firebase.projectId &&
    appConfig.firebase.privateKey &&
    appConfig.firebase.clientEmail
  ) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: appConfig.firebase.projectId,
          privateKey: appConfig.firebase.privateKey,
          clientEmail: appConfig.firebase.clientEmail,
        }),
      });
      firebaseInitialized = true;
      logger.info('Firebase Admin SDK initialized');
    } catch (error) {
      logger.warn('Failed to initialize Firebase Admin SDK. Push notifications disabled.', { error });
      logger.warn('To enable push notifications, configure valid Firebase credentials in .env');
    }
  } else {
    logger.warn('Firebase credentials not configured, push notifications disabled');
  }
};

// Initialize on module load
initializeFirebase();

/**
 * Send push notification to specific FCM tokens
 */
export const sendNotification = async (
  tokens: string[],
  notification: INotificationPayload
): Promise<void> => {
  if (!firebaseInitialized || tokens.length === 0) {
    logger.debug('Skipping notification: Firebase not initialized or no tokens');
    return;
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          // Remove invalid tokens
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokens[idx]);
          }
          logger.warn({ token: tokens[idx], error: resp.error }, 'FCM send failed');
        }
      });

      // Remove invalid tokens from database
      if (failedTokens.length > 0) {
        await removeInvalidTokens(failedTokens);
      }
    }

    logger.info({
      successCount: response.successCount,
      failureCount: response.failureCount,
    }, 'Push notification sent');
  } catch (error) {
    logger.error({ error }, 'Failed to send push notification');
  }
};

/**
 * Remove invalid FCM tokens from all users
 */
const removeInvalidTokens = async (tokens: string[]): Promise<void> => {
  await User.updateMany(
    { fcmTokens: { $in: tokens } },
    { $pullAll: { fcmTokens: tokens } }
  );
  logger.info({ count: tokens.length }, 'Removed invalid FCM tokens');
};

/**
 * Send notification to a specific user
 */
export const sendToUser = async (
  userId: string,
  notification: INotificationPayload
): Promise<void> => {
  const user = await User.findById(userId).select('fcmTokens settings');
  if (!user || user.fcmTokens.length === 0) {
    return;
  }

  // Check if user has notifications enabled
  if (!user.settings.notifications.messages) {
    return;
  }

  await sendNotification(user.fcmTokens, notification);
};

/**
 * Send notification to multiple users
 */
export const sendToUsers = async (
  userIds: string[],
  notification: INotificationPayload
): Promise<void> => {
  const users = await User.find({
    _id: { $in: userIds },
    fcmTokens: { $ne: [] },
    'settings.notifications.messages': true,
  }).select('fcmTokens');

  const allTokens = users.flatMap((user) => user.fcmTokens);

  if (allTokens.length > 0) {
    // FCM supports max 500 tokens per request
    const chunks = chunkArray(allTokens, 500);
    for (const chunk of chunks) {
      await sendNotification(chunk, notification);
    }
  }
};

/**
 * Send new message notification
 */
export const sendMessageNotification = async (
  message: IMessage,
  sender: IUser,
  recipientIds: string[]
): Promise<void> => {
  let body = message.content;
  
  // Customize body based on message type
  switch (message.messageType) {
    case 'image':
      body = '📷 Photo';
      break;
    case 'video':
      body = '🎥 Video';
      break;
    case 'audio':
      body = '🎵 Audio message';
      break;
    case 'file':
      body = '📎 File';
      break;
    case 'location':
      body = '📍 Location';
      break;
    case 'sticker':
      body = '🎭 Sticker';
      break;
  }

  const notification: INotificationPayload = {
    title: sender.displayName,
    body,
    data: {
      type: 'message',
      chatId: message.chatId.toString(),
      chatType: message.chatType,
      messageId: message._id.toString(),
      senderId: sender._id.toString(),
    },
  };

  if (sender.avatar) {
    notification.imageUrl = sender.avatar;
  }

  await sendToUsers(recipientIds, notification);
};

/**
 * Send incoming call notification
 */
export const sendCallNotification = async (
  call: ICall,
  caller: IUser,
  recipientIds: string[]
): Promise<void> => {
  const notification: INotificationPayload = {
    title: `Incoming ${call.callType} call`,
    body: `${caller.displayName} is calling...`,
    data: {
      type: 'call',
      callId: call.callId,
      callType: call.callType,
      callerId: caller._id.toString(),
      callerName: caller.displayName,
      callerAvatar: caller.avatar || '',
    },
  };

  // For calls, we send high-priority notifications
  const users = await User.find({
    _id: { $in: recipientIds },
    fcmTokens: { $ne: [] },
    'settings.notifications.calls': true,
  }).select('fcmTokens');

  const allTokens = users.flatMap((user) => user.fcmTokens);

  if (allTokens.length > 0 && firebaseInitialized) {
    const message: admin.messaging.MulticastMessage = {
      tokens: allTokens,
      data: {
        ...notification.data,
        title: notification.title,
        body: notification.body,
      },
      android: {
        priority: 'high',
        ttl: 30000, // 30 seconds
        notification: {
          sound: 'ringtone',
          channelId: 'incoming_calls',
          priority: 'max',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'ringtone.caf',
            badge: 1,
            category: 'INCOMING_CALL',
          },
        },
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'voip',
        },
      },
    };

    await admin.messaging().sendEachForMulticast(message);
  }
};

/**
 * Send missed call notification
 */
export const sendMissedCallNotification = async (
  caller: IUser,
  recipientIds: string[],
  callType: 'audio' | 'video'
): Promise<void> => {
  const notification: INotificationPayload = {
    title: 'Missed call',
    body: `You missed a ${callType} call from ${caller.displayName}`,
    data: {
      type: 'missed_call',
      callerId: caller._id.toString(),
      callerName: caller.displayName,
      callType,
    },
  };

  await sendToUsers(recipientIds, notification);
};

/**
 * Send group notification
 */
export const sendGroupNotification = async (
  groupId: string,
  groupName: string,
  notification: INotificationPayload,
  excludeUserIds: string[] = []
): Promise<void> => {
  const { Group } = await import('../models');
  const group = await Group.findById(groupId).select('members');

  if (!group) return;

  const recipientIds = group.members
    .map((m: any) => m.userId.toString())
    .filter((id: string) => !excludeUserIds.includes(id));

  notification.data = {
    ...notification.data,
    type: 'group',
    groupId,
    groupName,
  };

  await sendToUsers(recipientIds, notification);
};

/**
 * Helper function to chunk array
 */
const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export default {
  sendNotification,
  sendToUser,
  sendToUsers,
  sendMessageNotification,
  sendCallNotification,
  sendMissedCallNotification,
  sendGroupNotification,
};
