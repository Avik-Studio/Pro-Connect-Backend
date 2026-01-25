// ===========================================
// PROCONNECT - SOCKET.IO HANDLERS
// Real-time messaging and presence
// ===========================================

import { Server as SocketServer, Socket } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config';
import { redis, redisPub, redisSub } from '../config/redis';
import { User, Message, Conversation } from '../models';
import { chatService, userService, notificationService, callService } from '../services';
import { logger } from '../utils/logger';
import { ClientToServerEvents, ServerToClientEvents, SocketData } from '../types';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

interface AuthenticatedSocket extends Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData> {
  userId: string;
  username: string;
}

// ===========================================
// SOCKET.IO INITIALIZATION
// ===========================================

let io: SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export const initializeSocketIO = (httpServer: Server): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: [
        appConfig.frontend.url,
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token as string, appConfig.jwt.accessSecret) as {
        userId: string;
        username: string;
      };

      // Attach user data to socket
      socket.data.userId = decoded.userId;
      socket.data.username = decoded.username;

      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Invalid token'));
    }
  });

  // Handle connections
  io.on('connection', handleConnection);

  // Setup Redis pub/sub for horizontal scaling
  setupRedisPubSub();

  logger.info('Socket.IO initialized');

  return io;
};

// ===========================================
// CONNECTION HANDLER
// ===========================================

const handleConnection = async (socket: Socket) => {
  const userId = socket.data.userId;
  const username = socket.data.username;

  logger.info(`User connected: ${username} (${userId}) - Socket: ${socket.id}`);

  // Join user's personal room
  socket.join(`user:${userId}`);

  // Set user online status
  await setUserOnline(userId, socket.id);

  // Emit online status to contacts
  await broadcastPresence(userId, true);

  // ===========================================
  // CHAT EVENT HANDLERS
  // ===========================================

  // Join conversation rooms
  socket.on('join-conversation', async (conversationId: string) => {
    try {
      // Verify user is participant
      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.user': userId,
      });

      if (conversation) {
        socket.join(`conversation:${conversationId}`);
        logger.debug(`User ${userId} joined conversation ${conversationId}`);
      }
    } catch (error) {
      logger.error('Error joining conversation:', error);
    }
  });

  // Leave conversation room
  socket.on('leave-conversation', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
    logger.debug(`User ${userId} left conversation ${conversationId}`);
  });

  // Send message
  socket.on('send-message', async (data, callback) => {
    try {
      const { conversationId, content, messageType, media, replyTo, tempId } = data;

      const message = await chatService.sendMessage(
        userId,
        conversationId,
        content,
        messageType,
        media,
        replyTo
      );

      // Emit to all participants in the conversation
      io.to(`conversation:${conversationId}`).emit('new-message', message);

      // Send push notifications to offline participants
      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        const senderUser = await User.findById(userId);
        if (senderUser) {
          for (const participantId of conversation.participants) {
            if (participantId.toString() !== userId) {
              const isOnline = await isUserOnline(participantId.toString());
              if (!isOnline) {
                await notificationService.sendMessageNotification(
                  message,
                  senderUser,
                  [participantId.toString()]
                );
              }
            }
          }
        }
      }

      callback?.({ success: true, message, tempId });
    } catch (error) {
      logger.error('Error sending message:', error);
      callback?.({ success: false, error: (error as Error).message });
    }
  });

  // Typing indicator
  socket.on('typing-start', async (conversationId: string) => {
    socket.to(`conversation:${conversationId}`).emit('user-typing', {
      conversationId,
      userId,
      username,
    });
  });

  socket.on('typing-stop', async (conversationId: string) => {
    socket.to(`conversation:${conversationId}`).emit('user-stop-typing', {
      conversationId,
      userId,
    });
  });

  // Message read/delivered receipts
  socket.on('message-delivered', async (data) => {
    try {
      const { messageId, conversationId } = data;
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: {
          deliveredTo: {
            user: userId,
            deliveredAt: new Date(),
          },
        },
      });

      io.to(`conversation:${conversationId}`).emit('message-status-update', {
        messageId,
        status: 'delivered',
        userId,
      });
    } catch (error) {
      logger.error('Error updating delivery status:', error);
    }
  });

  socket.on('message-read', async (data) => {
    try {
      const { messageId, conversationId } = data;
      await chatService.markAsSeen(conversationId, userId);

      io.to(`conversation:${conversationId}`).emit('message-status-update', {
        messageId,
        status: 'seen',
        userId,
      });
    } catch (error) {
      logger.error('Error updating read status:', error);
    }
  });

  // ===========================================
  // CALL EVENT HANDLERS (WebRTC Signaling)
  // ===========================================

  // Initiate call
  socket.on('call-initiate', async (data, callback) => {
    try {
      const { receiverId, callType, groupId } = data;
      const receiverIds = groupId ? [] : [receiverId!];

      const call = await callService.initiateCall(userId, receiverIds, callType, groupId);

      // Notify receiver(s)
      if (groupId) {
        io.to(`group:${groupId}`).emit('incoming-call', {
          call,
          caller: { id: userId, username },
        });
      } else {
        io.to(`user:${receiverId}`).emit('incoming-call', {
          call,
          caller: { id: userId, username },
        });

        // Send push notification if offline
        const isReceiverOnline = await isUserOnline(receiverId!);
        if (!isReceiverOnline) {
          const callerUser = await User.findById(userId);
          if (callerUser) {
            await notificationService.sendCallNotification(call, callerUser, [receiverId!]);
          }
        }
      }

      callback?.({ success: true, call });
    } catch (error) {
      logger.error('Error initiating call:', error);
      callback?.({ success: false, error: (error as Error).message });
    }
  });

  // WebRTC signaling: offer
  socket.on('call-offer', async (data) => {
    const { callId, targetUserId, offer } = data;
    io.to(`user:${targetUserId}`).emit('call-offer', {
      callId,
      fromUserId: userId,
      offer,
    });
  });

  // WebRTC signaling: answer
  socket.on('call-answer', async (data) => {
    const { callId, targetUserId, answer } = data;
    io.to(`user:${targetUserId}`).emit('call-answer', {
      callId,
      fromUserId: userId,
      answer,
    });
  });

  // WebRTC signaling: ICE candidate
  socket.on('ice-candidate', async (data) => {
    const { callId, targetUserId, candidate } = data;
    io.to(`user:${targetUserId}`).emit('ice-candidate', {
      callId,
      fromUserId: userId,
      candidate,
    });
  });

  // Accept call
  socket.on('call-accept', async (data, callback) => {
    try {
      const { callId } = data;
      const call = await callService.acceptCall(callId, userId);

      // Notify caller
      io.to(`user:${call.caller.toString()}`).emit('call-accepted', {
        callId,
        acceptedBy: userId,
      });

      callback?.({ success: true, call });
    } catch (error) {
      logger.error('Error accepting call:', error);
      callback?.({ success: false, error: (error as Error).message });
    }
  });

  // Reject call
  socket.on('call-reject', async (data, callback) => {
    try {
      const { callId, reason } = data;
      const call = await callService.rejectCall(callId, userId, reason);

      // Notify caller
      io.to(`user:${call.caller.toString()}`).emit('call-rejected', {
        callId,
        rejectedBy: userId,
        reason,
      });

      callback?.({ success: true });
    } catch (error) {
      logger.error('Error rejecting call:', error);
      callback?.({ success: false, error: (error as Error).message });
    }
  });

  // End call
  socket.on('call-end', async (data, callback) => {
    try {
      const { callId, reason } = data;
      const call = await callService.endCall(callId, userId, reason);

      // Notify all participants
      for (const participant of call.participants) {
        io.to(`user:${participant.userId.toString()}`).emit('call-ended', {
          callId,
          endedBy: userId,
          reason,
          duration: call.duration,
        });
      }

      callback?.({ success: true });
    } catch (error) {
      logger.error('Error ending call:', error);
      callback?.({ success: false, error: (error as Error).message });
    }
  });

  // Toggle media (mute/unmute, video on/off)
  socket.on('toggle-media', async (data) => {
    const { callId, mediaType, enabled } = data;
    
    // Broadcast to other call participants
    io.to(`call:${callId}`).emit('media-toggled', {
      userId,
      mediaType,
      enabled,
    });
  });

  // ===========================================
  // GROUP EVENT HANDLERS
  // ===========================================

  socket.on('join-group', (groupId: string) => {
    socket.join(`group:${groupId}`);
    logger.debug(`User ${userId} joined group room ${groupId}`);
  });

  socket.on('leave-group', (groupId: string) => {
    socket.leave(`group:${groupId}`);
    logger.debug(`User ${userId} left group room ${groupId}`);
  });

  // ===========================================
  // PRESENCE HANDLERS
  // ===========================================

  socket.on('presence-subscribe', async (userIds: string[]) => {
    // Subscribe to presence updates for specific users
    for (const targetUserId of userIds) {
      socket.join(`presence:${targetUserId}`);
    }

    // Send current online status
    const statuses = await userService.getOnlineStatuses(userIds);
    socket.emit('presence-update', Object.fromEntries(statuses));
  });

  socket.on('presence-unsubscribe', (userIds: string[]) => {
    for (const targetUserId of userIds) {
      socket.leave(`presence:${targetUserId}`);
    }
  });

  // ===========================================
  // DISCONNECTION HANDLER
  // ===========================================

  socket.on('disconnect', async (reason) => {
    logger.info(`User disconnected: ${username} (${userId}) - Reason: ${reason}`);

    // Remove from online users
    await setUserOffline(userId, socket.id);

    // Check if user has other active connections
    const otherSockets = await getSocketsForUser(userId);
    if (otherSockets.length === 0) {
      // User completely offline
      await broadcastPresence(userId, false);
      
      // Update last seen
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
    }
  });
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

const setUserOnline = async (userId: string, socketId: string): Promise<void> => {
  const key = `online:${userId}`;
  await redis.sadd(key, socketId);
  await redis.expire(key, 86400); // 24 hours
  await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
};

const setUserOffline = async (userId: string, socketId: string): Promise<void> => {
  const key = `online:${userId}`;
  await redis.srem(key, socketId);
};

const isUserOnline = async (userId: string): Promise<boolean> => {
  const key = `online:${userId}`;
  const count = await redis.scard(key);
  return count > 0;
};

const getSocketsForUser = async (userId: string): Promise<string[]> => {
  const key = `online:${userId}`;
  return redis.smembers(key);
};

const broadcastPresence = async (userId: string, isOnline: boolean): Promise<void> => {
  io.to(`presence:${userId}`).emit('presence-update', {
    [userId]: {
      isOnline,
      lastSeen: isOnline ? null : new Date().toISOString(),
    },
  });
};

// ===========================================
// REDIS PUB/SUB FOR HORIZONTAL SCALING
// ===========================================

const setupRedisPubSub = (): void => {
  // Subscribe to channels
  redisSub.subscribe('chat:message', 'call:signal', 'presence:update');

  redisSub.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);

      switch (channel) {
        case 'chat:message':
          handleDistributedMessage(data);
          break;
        case 'call:signal':
          handleDistributedCallSignal(data);
          break;
        case 'presence:update':
          handleDistributedPresence(data);
          break;
      }
    } catch (error) {
      logger.error('Redis pub/sub error:', error);
    }
  });
};

const handleDistributedMessage = (data: any): void => {
  io.to(`conversation:${data.conversationId}`).emit('new-message', data.message);
};

const handleDistributedCallSignal = (data: any): void => {
  io.to(`user:${data.targetUserId}`).emit(data.event, data.payload);
};

const handleDistributedPresence = (data: any): void => {
  io.to(`presence:${data.userId}`).emit('presence-update', {
    [data.userId]: data.status,
  });
};

// ===========================================
// UTILITY EXPORTS
// ===========================================

export const getIO = (): SocketServer => io;

export const emitToUser = (userId: string, event: string, data: any): void => {
  io.to(`user:${userId}`).emit(event as any, data);
};

export const emitToConversation = (conversationId: string, event: string, data: any): void => {
  io.to(`conversation:${conversationId}`).emit(event as any, data);
};

export const emitToGroup = (groupId: string, event: string, data: any): void => {
  io.to(`group:${groupId}`).emit(event as any, data);
};

export default { initializeSocketIO, getIO, emitToUser, emitToConversation, emitToGroup };
