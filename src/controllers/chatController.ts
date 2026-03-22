// ===========================================
// PROCONNECT - CHAT CONTROLLER
// Chat and messaging API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';
import { emitToConversation } from '../socket';
import { logger } from '../utils/logger';

/**
 * Get all conversations for current user
 * GET /api/v1/chat/conversations
 */
export const getConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] GET /conversations');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug({ query: req.query }, 'Query params');

    const { page = '1', limit = '20' } = req.query;
    const { conversations, meta } = await chatService.getUserConversations(
      req.userId!,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    logger.debug(`Retrieved ${conversations.length} conversations`);

    sendSuccess(res, 'Conversations retrieved successfully', { conversations }, meta);
  } catch (error) {
    logger.error(`[CHAT] Get conversations error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Get or create private conversation with a user
 * POST /api/v1/chat/conversations/private
 */
export const getOrCreatePrivateConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] POST /conversations/private');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Target user ID: ${req.body.userId}`);

    const { userId } = req.body;
    const conversation = await chatService.getOrCreatePrivateConversation(
      req.userId!,
      userId
    );

    logger.debug(`Conversation retrieved/created. ID: ${conversation._id}`);

    sendSuccess(res, 'Conversation retrieved successfully', { conversation });
  } catch (error) {
    logger.error(`[CHAT] Get/create conversation error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Get conversation by ID
 * GET /api/v1/chat/conversations/:id
 */
export const getConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] GET /conversations/:id');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Conversation ID: ${req.params.id}`);

    const { id } = req.params;
    const conversation = await chatService.getConversationById(id, req.userId!);

    logger.debug('Conversation retrieved');

    sendSuccess(res, 'Conversation retrieved successfully', { conversation });
  } catch (error) {
    logger.error(`[CHAT] Get conversation error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Get messages for a conversation
 * GET /api/v1/chat/conversations/:id/messages
 */
export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] GET /conversations/:id/messages');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Conversation ID: ${req.params.id}`);
    logger.debug({ query: req.query }, 'Query params');

    const { id } = req.params;
    const { page = '1', limit = '50' } = req.query;
    const { messages, meta } = await chatService.getMessages(
      id,
      req.userId!,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    logger.debug(`Retrieved ${messages.length} messages`);

    sendSuccess(res, 'Messages retrieved successfully', { messages }, meta);
  } catch (error) {
    logger.error(`[CHAT] Get messages error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Send a message
 * POST /api/v1/chat/conversations/:id/messages
 */
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] POST /conversations/:id/messages');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Conversation ID: ${req.params.id}`);
    logger.debug({
      content: req.body.content?.substring(0, 50) + (req.body.content?.length > 50 ? '...' : ''),
      messageType: req.body.messageType,
      hasMedia: !!req.body.media?.length,
      replyTo: req.body.replyTo,
    }, 'Message data');

    const { id } = req.params;
    const { content, messageType, media, replyTo } = req.body;

    // Route validation accepts media as array; Mongoose schema stores single object
    const mediaObj = Array.isArray(media) && media.length > 0 ? media[0] : media;

    const message = await chatService.sendMessage(
      req.userId!,
      id,
      content,
      messageType,
      mediaObj,
      replyTo
    );

    logger.debug(`Message sent. ID: ${message._id}`);

    // Emit real-time event to all users in the conversation
    emitToConversation(id, 'new-message', {
      message,
      conversationId: id
    });

    logger.debug(`Real-time event emitted to conversation: ${id}`);

    sendCreated(res, 'Message sent successfully', { message });
  } catch (error) {
    logger.error(`[CHAT] Send message error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Mark messages as seen
 * POST /api/v1/chat/conversations/:id/seen
 */
export const markAsSeen = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] POST /conversations/:id/seen');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Conversation ID: ${req.params.id}`);

    const { id } = req.params;
    await chatService.markAsSeen(id, req.userId!);

    logger.debug('Messages marked as seen');

    // Emit real-time event to notify other users
    emitToConversation(id, 'messages-seen', {
      conversationId: id,
      userId: req.userId,
      seenAt: new Date()
    });

    logger.debug('Real-time seen event emitted');

    sendSuccess(res, 'Messages marked as seen');
  } catch (error) {
    logger.error(`[CHAT] Mark as seen error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Delete a message
 * DELETE /api/v1/chat/messages/:id
 */
export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] DELETE /messages/:id');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Message ID: ${req.params.id}`);
    logger.debug(`Delete for everyone: ${req.body.deleteForEveryone}`);

    const { id } = req.params;
    const { deleteForEveryone = false } = req.body;
    const message = await chatService.deleteMessage(id, req.userId!, deleteForEveryone);

    logger.debug('Message deleted');

    // Emit real-time event
    if (message.chatId) {
      emitToConversation(message.chatId.toString(), 'message-deleted', {
        messageId: id,
        conversationId: message.chatId.toString(),
        deleteForEveryone
      });
      logger.debug('Real-time delete event emitted');
    }

    sendSuccess(res, 'Message deleted successfully', { message });
  } catch (error) {
    logger.error(`[CHAT] Delete message error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Edit a message
 * PATCH /api/v1/chat/messages/:id
 */
export const editMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] PATCH /messages/:id');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Message ID: ${req.params.id}`);
    logger.debug(`New content: ${req.body.content?.substring(0, 50)}...`);

    const { id } = req.params;
    const { content } = req.body;
    const message = await chatService.editMessage(id, req.userId!, content);

    logger.debug('Message edited');

    // Emit real-time event
    if (message.chatId) {
      emitToConversation(message.chatId.toString(), 'message-updated', {
        message,
        conversationId: message.chatId.toString()
      });
      logger.debug('Real-time edit event emitted');
    }

    sendSuccess(res, 'Message edited successfully', { message });
  } catch (error) {
    logger.error(`[CHAT] Edit message error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Get total unread count
 * GET /api/v1/chat/unread-count
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] GET /unread-count');
    logger.debug(`User ID: ${req.userId}`);

    const count = await chatService.getUnreadCount(req.userId!);

    logger.debug(`Unread count: ${count}`);

    sendSuccess(res, 'Unread count retrieved successfully', { count });
  } catch (error) {
    logger.error(`[CHAT] Get unread count error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Pin/unpin conversation
 * POST /api/v1/chat/conversations/:id/pin
 */
export const togglePin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] POST /conversations/:id/pin');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Conversation ID: ${req.params.id}`);

    const { id } = req.params;
    const isPinned = await chatService.togglePinConversation(id, req.userId!);

    logger.debug(`Conversation ${isPinned ? 'pinned' : 'unpinned'}`);

    sendSuccess(res, isPinned ? 'Conversation pinned' : 'Conversation unpinned', {
      isPinned,
    });
  } catch (error) {
    logger.error(`[CHAT] Toggle pin error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Mute conversation
 * POST /api/v1/chat/conversations/:id/mute
 */
export const muteConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] POST /conversations/:id/mute');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Conversation ID: ${req.params.id}`);
    logger.debug(`Mute until: ${req.body.muteUntil}`);

    const { id } = req.params;
    const { muteUntil } = req.body;
    const mutedUntil = await chatService.muteConversation(
      id,
      req.userId!,
      muteUntil ? new Date(muteUntil) : undefined
    );

    logger.debug(`Conversation ${mutedUntil ? 'muted until ' + mutedUntil : 'unmuted'}`);

    sendSuccess(res, mutedUntil ? 'Conversation muted' : 'Conversation unmuted', {
      mutedUntil,
    });
  } catch (error) {
    logger.error(`[CHAT] Mute conversation error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Search messages in conversation
 * GET /api/v1/chat/conversations/:id/search
 */
export const searchMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CHAT] GET /conversations/:id/search');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Conversation ID: ${req.params.id}`);
    logger.debug(`Search query: ${req.query.q}`);

    const { id } = req.params;
    const { q, page = '1', limit = '20' } = req.query;
    const { messages, meta } = await chatService.searchMessages(
      id,
      req.userId!,
      q as string,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    logger.debug(`Found ${messages.length} messages matching query`);

    sendSuccess(res, 'Messages found', { messages }, meta);
  } catch (error) {
    logger.error(`[CHAT] Search messages error: ${(error as Error).message}`);
    next(error);
  }
};

export default {
  getConversations,
  getOrCreatePrivateConversation,
  getConversation,
  getMessages,
  sendMessage,
  markAsSeen,
  deleteMessage,
  editMessage,
  getUnreadCount,
  togglePin,
  muteConversation,
  searchMessages,
};
