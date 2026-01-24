// ===========================================
// PROCONNECT - CHAT CONTROLLER
// Chat and messaging API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

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
    console.log('\n💬 [CHAT] GET /conversations');
    console.log('👤 User ID:', req.userId);
    console.log('📥 Query params:', req.query);

    const { page = '1', limit = '20' } = req.query;
    const { conversations, meta } = await chatService.getUserConversations(
      req.userId!,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    console.log('✅ Retrieved', conversations.length, 'conversations');

    sendSuccess(res, 'Conversations retrieved successfully', { conversations }, meta);
  } catch (error) {
    console.error('❌ [CHAT] Get conversations error:', (error as Error).message);
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
    console.log('\n💬 [CHAT] POST /conversations/private');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Target user ID:', req.body.userId);

    const { userId } = req.body;
    const conversation = await chatService.getOrCreatePrivateConversation(
      req.userId!,
      userId
    );

    console.log('✅ Conversation retrieved/created. ID:', conversation._id);

    sendSuccess(res, 'Conversation retrieved successfully', { conversation });
  } catch (error) {
    console.error('❌ [CHAT] Get/create conversation error:', (error as Error).message);
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
    console.log('\n💬 [CHAT] GET /conversations/:id');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Conversation ID:', req.params.id);

    const { id } = req.params;
    const conversation = await chatService.getConversationById(id, req.userId!);

    console.log('✅ Conversation retrieved');

    sendSuccess(res, 'Conversation retrieved successfully', { conversation });
  } catch (error) {
    console.error('❌ [CHAT] Get conversation error:', (error as Error).message);
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
    console.log('\n📨 [CHAT] GET /conversations/:id/messages');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Conversation ID:', req.params.id);
    console.log('📥 Query params:', req.query);

    const { id } = req.params;
    const { page = '1', limit = '50' } = req.query;
    const { messages, meta } = await chatService.getMessages(
      id,
      req.userId!,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    console.log('✅ Retrieved', messages.length, 'messages');

    sendSuccess(res, 'Messages retrieved successfully', { messages }, meta);
  } catch (error) {
    console.error('❌ [CHAT] Get messages error:', (error as Error).message);
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
    console.log('\n📤 [CHAT] POST /conversations/:id/messages');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Conversation ID:', req.params.id);
    console.log('📥 Message data:', {
      content: req.body.content?.substring(0, 50) + (req.body.content?.length > 50 ? '...' : ''),
      messageType: req.body.messageType,
      hasMedia: !!req.body.media?.length,
      replyTo: req.body.replyTo,
    });

    const { id } = req.params;
    const { content, messageType, media, replyTo } = req.body;
    const message = await chatService.sendMessage(
      req.userId!,
      id,
      content,
      messageType,
      media,
      replyTo
    );

    console.log('✅ Message sent. ID:', message._id);

    sendCreated(res, 'Message sent successfully', { message });
  } catch (error) {
    console.error('❌ [CHAT] Send message error:', (error as Error).message);
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
    console.log('\n👁️ [CHAT] POST /conversations/:id/seen');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Conversation ID:', req.params.id);

    const { id } = req.params;
    await chatService.markAsSeen(id, req.userId!);

    console.log('✅ Messages marked as seen');

    sendSuccess(res, 'Messages marked as seen');
  } catch (error) {
    console.error('❌ [CHAT] Mark as seen error:', (error as Error).message);
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
    console.log('\n🗑️ [CHAT] DELETE /messages/:id');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Message ID:', req.params.id);
    console.log('📥 Delete for everyone:', req.body.deleteForEveryone);

    const { id } = req.params;
    const { deleteForEveryone = false } = req.body;
    const message = await chatService.deleteMessage(id, req.userId!, deleteForEveryone);

    console.log('✅ Message deleted');

    sendSuccess(res, 'Message deleted successfully', { message });
  } catch (error) {
    console.error('❌ [CHAT] Delete message error:', (error as Error).message);
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
    console.log('\n✏️ [CHAT] PATCH /messages/:id');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Message ID:', req.params.id);
    console.log('📥 New content:', req.body.content?.substring(0, 50) + '...');

    const { id } = req.params;
    const { content } = req.body;
    const message = await chatService.editMessage(id, req.userId!, content);

    console.log('✅ Message edited');

    sendSuccess(res, 'Message edited successfully', { message });
  } catch (error) {
    console.error('❌ [CHAT] Edit message error:', (error as Error).message);
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
    console.log('\n🔢 [CHAT] GET /unread-count');
    console.log('👤 User ID:', req.userId);

    const count = await chatService.getUnreadCount(req.userId!);

    console.log('✅ Unread count:', count);

    sendSuccess(res, 'Unread count retrieved successfully', { count });
  } catch (error) {
    console.error('❌ [CHAT] Get unread count error:', (error as Error).message);
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
    console.log('\n📌 [CHAT] POST /conversations/:id/pin');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Conversation ID:', req.params.id);

    const { id } = req.params;
    const isPinned = await chatService.togglePinConversation(id, req.userId!);

    console.log('✅ Conversation', isPinned ? 'pinned' : 'unpinned');

    sendSuccess(res, isPinned ? 'Conversation pinned' : 'Conversation unpinned', {
      isPinned,
    });
  } catch (error) {
    console.error('❌ [CHAT] Toggle pin error:', (error as Error).message);
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
    console.log('\n🔇 [CHAT] POST /conversations/:id/mute');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Conversation ID:', req.params.id);
    console.log('📥 Mute until:', req.body.muteUntil);

    const { id } = req.params;
    const { muteUntil } = req.body;
    const mutedUntil = await chatService.muteConversation(
      id,
      req.userId!,
      muteUntil ? new Date(muteUntil) : undefined
    );

    console.log('✅ Conversation', mutedUntil ? 'muted until ' + mutedUntil : 'unmuted');

    sendSuccess(res, mutedUntil ? 'Conversation muted' : 'Conversation unmuted', {
      mutedUntil,
    });
  } catch (error) {
    console.error('❌ [CHAT] Mute conversation error:', (error as Error).message);
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
    console.log('\n🔍 [CHAT] GET /conversations/:id/search');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Conversation ID:', req.params.id);
    console.log('📥 Search query:', req.query.q);

    const { id } = req.params;
    const { q, page = '1', limit = '20' } = req.query;
    const { messages, meta } = await chatService.searchMessages(
      id,
      req.userId!,
      q as string,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    console.log('✅ Found', messages.length, 'messages matching query');

    sendSuccess(res, 'Messages found', { messages }, meta);
  } catch (error) {
    console.error('❌ [CHAT] Search messages error:', (error as Error).message);
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
