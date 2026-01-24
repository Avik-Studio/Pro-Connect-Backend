// ===========================================
// PROCONNECT - CHAT SERVICE
// Chat and messaging business logic
// ===========================================

import { Types } from 'mongoose';
import { Message, Conversation, User } from '../models';
import { 
  IMessage, 
  IConversation, 
  IMediaAttachment, 
  IPaginationMeta,
  ChatType,
  MessageType 
} from '../types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { generatePaginationMeta, parsePaginationQuery, toObjectId } from '../utils/helpers';

/**
 * Get or create private conversation between two users
 */
export const getOrCreatePrivateConversation = async (
  userId1: string,
  userId2: string
): Promise<IConversation> => {
  return (Conversation as any).findOrCreatePrivate(
    toObjectId(userId1),
    toObjectId(userId2)
  );
};

/**
 * Get user's conversations with pagination
 */
export const getUserConversations = async (
  userId: string,
  page = 1,
  limit = 20
): Promise<{ conversations: IConversation[]; meta: IPaginationMeta }> => {
  const total = await Conversation.countDocuments({
    participants: toObjectId(userId),
  });

  const conversations = await (Conversation as any).getUserConversations(
    toObjectId(userId),
    page,
    limit
  );

  return {
    conversations,
    meta: generatePaginationMeta(total, page, limit),
  };
};

/**
 * Get conversation by ID
 */
export const getConversationById = async (
  conversationId: string,
  userId: string
): Promise<IConversation> => {
  const conversation = await Conversation.findById(conversationId)
    .populate('participants', 'displayName avatar username isOnline lastSeen')
    .populate('lastMessage')
    .populate('groupId', 'name avatar');

  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    (p: any) => p._id.toString() === userId
  );

  if (!isParticipant) {
    throw new ForbiddenError('You are not a participant of this conversation');
  }

  return conversation;
};

/**
 * Send a message
 */
export const sendMessage = async (
  senderId: string,
  conversationId: string,
  content: string,
  messageType: MessageType = 'text',
  media?: IMediaAttachment,
  replyTo?: string
): Promise<IMessage> => {
  // Get conversation
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  // Verify sender is participant
  const isParticipant = conversation.participants.some(
    (p: Types.ObjectId) => p.toString() === senderId
  );

  if (!isParticipant) {
    throw new ForbiddenError('You are not a participant of this conversation');
  }

  // Validate message content
  if (messageType === 'text' && !content?.trim()) {
    throw new BadRequestError('Message content is required for text messages');
  }

  if (['image', 'video', 'audio', 'file'].includes(messageType) && !media) {
    throw new BadRequestError('Media attachment is required for this message type');
  }

  // Create message
  const message = await Message.create({
    chatId: conversationId,
    chatType: conversation.isGroup ? 'group' : 'private',
    sender: toObjectId(senderId),
    content: content || '',
    messageType,
    media,
    replyTo: replyTo ? toObjectId(replyTo) : undefined,
    status: 'sent',
  });

  // Update conversation
  await (Conversation as any).updateLastMessage(
    toObjectId(conversationId),
    message._id,
    toObjectId(senderId)
  );

  // Populate sender info
  await message.populate('sender', 'displayName avatar username');
  if (replyTo) {
    await message.populate('replyTo', 'content messageType sender');
  }

  return message;
};

/**
 * Get messages for a conversation
 */
export const getMessages = async (
  conversationId: string,
  userId: string,
  page = 1,
  limit = 50
): Promise<{ messages: IMessage[]; meta: IPaginationMeta }> => {
  // Verify user is participant
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  const isParticipant = conversation.participants.some(
    (p: Types.ObjectId) => p.toString() === userId
  );

  if (!isParticipant) {
    throw new ForbiddenError('You are not a participant of this conversation');
  }

  // Get messages
  const total = await Message.countDocuments({
    chatId: conversationId,
    isDeleted: false,
    deletedFor: { $ne: toObjectId(userId) },
  });

  const { skip, sort } = parsePaginationQuery({ page, limit, sortOrder: 'desc' });

  const messages = await Message.find({
    chatId: conversationId,
    isDeleted: false,
    deletedFor: { $ne: toObjectId(userId) },
  })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('sender', 'displayName avatar username')
    .populate('replyTo', 'content messageType sender');

  return {
    messages: messages.reverse(), // Return in chronological order
    meta: generatePaginationMeta(total, page, limit),
  };
};

/**
 * Mark messages as delivered
 */
export const markAsDelivered = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  await (Message as any).markAsDelivered(
    toObjectId(conversationId),
    toObjectId(userId)
  );
};

/**
 * Mark messages as seen and reset unread count
 */
export const markAsSeen = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  await (Message as any).markAsSeen(
    toObjectId(conversationId),
    toObjectId(userId)
  );

  await (Conversation as any).resetUnreadCount(
    toObjectId(conversationId),
    toObjectId(userId)
  );
};

/**
 * Delete message
 */
export const deleteMessage = async (
  messageId: string,
  userId: string,
  deleteForEveryone = false
): Promise<IMessage> => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new NotFoundError('Message not found');
  }

  // Only sender can delete for everyone
  if (deleteForEveryone && message.sender.toString() !== userId) {
    throw new ForbiddenError('Only the sender can delete message for everyone');
  }

  // Check if message is recent enough to delete for everyone (within 1 hour)
  if (deleteForEveryone) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (message.createdAt < hourAgo) {
      throw new BadRequestError('Message is too old to delete for everyone');
    }
  }

  const updatedMessage = await (Message as any).softDelete(
    toObjectId(messageId),
    toObjectId(userId),
    deleteForEveryone
  );

  return updatedMessage;
};

/**
 * Edit message
 */
export const editMessage = async (
  messageId: string,
  userId: string,
  newContent: string
): Promise<IMessage> => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new NotFoundError('Message not found');
  }

  // Only sender can edit
  if (message.sender.toString() !== userId) {
    throw new ForbiddenError('Only the sender can edit this message');
  }

  // Only text messages can be edited
  if (message.messageType !== 'text') {
    throw new BadRequestError('Only text messages can be edited');
  }

  // Check if message is recent enough to edit (within 15 minutes)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (message.createdAt < fifteenMinutesAgo) {
    throw new BadRequestError('Message is too old to edit');
  }

  message.content = newContent;
  message.isEdited = true;
  await message.save();

  return message;
};

/**
 * Get unread message count for user
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  const conversations = await Conversation.find({
    participants: toObjectId(userId),
  });

  let totalUnread = 0;
  for (const conv of conversations) {
    const unread = conv.unreadCount?.get(userId) || 0;
    totalUnread += unread;
  }

  return totalUnread;
};

/**
 * Pin/unpin conversation
 */
export const togglePinConversation = async (
  conversationId: string,
  userId: string
): Promise<boolean> => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  const currentPinned = conversation.isPinned?.get(userId) || false;
  const newPinned = !currentPinned;

  await Conversation.findByIdAndUpdate(conversationId, {
    $set: { [`isPinned.${userId}`]: newPinned },
  });

  return newPinned;
};

/**
 * Mute/unmute conversation
 */
export const muteConversation = async (
  conversationId: string,
  userId: string,
  muteUntil?: Date
): Promise<Date | null> => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  await Conversation.findByIdAndUpdate(conversationId, {
    $set: { [`isMuted.${userId}`]: muteUntil || null },
  });

  return muteUntil || null;
};

/**
 * Search messages in conversation
 */
export const searchMessages = async (
  conversationId: string,
  userId: string,
  query: string,
  page = 1,
  limit = 20
): Promise<{ messages: IMessage[]; meta: IPaginationMeta }> => {
  // Verify access
  await getConversationById(conversationId, userId);

  const searchRegex = new RegExp(query, 'i');

  const filter = {
    chatId: toObjectId(conversationId),
    content: searchRegex,
    isDeleted: false,
    deletedFor: { $ne: toObjectId(userId) },
  };

  const total = await Message.countDocuments(filter);
  const { skip } = parsePaginationQuery({ page, limit });

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'displayName avatar username');

  return {
    messages,
    meta: generatePaginationMeta(total, page, limit),
  };
};

export default {
  getOrCreatePrivateConversation,
  getUserConversations,
  getConversationById,
  sendMessage,
  getMessages,
  markAsDelivered,
  markAsSeen,
  deleteMessage,
  editMessage,
  getUnreadCount,
  togglePinConversation,
  muteConversation,
  searchMessages,
};
