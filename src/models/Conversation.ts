// ===========================================
// PROCONNECT - CONVERSATION MODEL
// MongoDB schema for chat conversations
// ===========================================

import mongoose, { Schema } from 'mongoose';
import { IConversation } from '../types';

// Main conversation schema
const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      validate: {
        validator: function (v: mongoose.Types.ObjectId[]) {
          return v.length >= 2;
        },
        message: 'Conversation must have at least 2 participants',
      },
      index: true,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      sparse: true,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    isPinned: {
      type: Map,
      of: Boolean,
      default: new Map(),
    },
    isMuted: {
      type: Map,
      of: Date,
      default: new Map(),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ===========================================
// INDEXES
// ===========================================

// Index for finding conversations by participants
conversationSchema.index({ participants: 1, isGroup: 1 });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ groupId: 1 }, { sparse: true });

// ===========================================
// STATIC METHODS
// ===========================================

/**
 * Find or create a private conversation between two users
 */
conversationSchema.statics.findOrCreatePrivate = async function (
  userId1: mongoose.Types.ObjectId,
  userId2: mongoose.Types.ObjectId
) {
  // Sort user IDs to ensure consistent lookup
  const participants = [userId1, userId2].sort((a, b) => 
    a.toString().localeCompare(b.toString())
  );

  let conversation = await this.findOne({
    participants: { $all: participants, $size: 2 },
    isGroup: false,
  });

  if (!conversation) {
    conversation = await this.create({
      participants,
      isGroup: false,
      unreadCount: new Map([
        [userId1.toString(), 0],
        [userId2.toString(), 0],
      ]),
    });
  }

  return conversation;
};

/**
 * Create a group conversation
 */
conversationSchema.statics.createGroupConversation = async function (
  groupId: mongoose.Types.ObjectId,
  memberIds: mongoose.Types.ObjectId[]
) {
  const unreadCount = new Map<string, number>();
  memberIds.forEach((id) => unreadCount.set(id.toString(), 0));

  return this.create({
    participants: memberIds,
    isGroup: true,
    groupId,
    unreadCount,
  });
};

/**
 * Get conversations for a user
 */
conversationSchema.statics.getUserConversations = function (
  userId: mongoose.Types.ObjectId,
  page = 1,
  limit = 20
) {
  return this.find({
    participants: userId,
  })
    .sort({ lastMessageAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('participants', 'displayName avatar username isOnline lastSeen')
    .populate('lastMessage', 'content messageType sender createdAt')
    .populate('groupId', 'name avatar');
};

/**
 * Update last message and unread counts
 */
conversationSchema.statics.updateLastMessage = async function (
  conversationId: mongoose.Types.ObjectId,
  messageId: mongoose.Types.ObjectId,
  senderId: mongoose.Types.ObjectId
) {
  const conversation = await this.findById(conversationId);
  if (!conversation) return null;

  // Increment unread count for all participants except sender
  const unreadCount = new Map<string, number>(conversation.unreadCount as Map<string, number>);
  conversation.participants.forEach((participantId: mongoose.Types.ObjectId) => {
    const participantStr = participantId.toString();
    if (participantStr !== senderId.toString()) {
      const current = unreadCount.get(participantStr) || 0;
      unreadCount.set(participantStr, current + 1);
    }
  });

  return this.findByIdAndUpdate(
    conversationId,
    {
      lastMessage: messageId,
      lastMessageAt: new Date(),
      unreadCount,
    },
    { new: true }
  );
};

/**
 * Reset unread count for a user
 */
conversationSchema.statics.resetUnreadCount = async function (
  conversationId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  const conversation = await this.findById(conversationId);
  if (!conversation) return null;

  const unreadCount = new Map(conversation.unreadCount);
  unreadCount.set(userId.toString(), 0);

  return this.findByIdAndUpdate(
    conversationId,
    { unreadCount },
    { new: true }
  );
};

/**
 * Add participant to conversation
 */
conversationSchema.statics.addParticipant = async function (
  conversationId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  return this.findByIdAndUpdate(
    conversationId,
    {
      $addToSet: { participants: userId },
      $set: { [`unreadCount.${userId.toString()}`]: 0 },
    },
    { new: true }
  );
};

/**
 * Remove participant from conversation
 */
conversationSchema.statics.removeParticipant = async function (
  conversationId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  return this.findByIdAndUpdate(
    conversationId,
    {
      $pull: { participants: userId },
      $unset: {
        [`unreadCount.${userId.toString()}`]: 1,
        [`isPinned.${userId.toString()}`]: 1,
        [`isMuted.${userId.toString()}`]: 1,
      },
    },
    { new: true }
  );
};

// Create and export the model
const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

export default Conversation;
