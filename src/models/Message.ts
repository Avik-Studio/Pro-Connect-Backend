// ===========================================
// PROCONNECT - MESSAGE MODEL
// MongoDB schema for chat messages
// ===========================================

import mongoose, { Schema } from 'mongoose';
import { IMessage, IMediaAttachment, IDeliveryReceipt } from '../types';

// Media attachment sub-schema
const mediaAttachmentSchema = new Schema<IMediaAttachment>(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // For audio/video in seconds
    },
    thumbnail: {
      type: String,
    },
    dimensions: {
      width: Number,
      height: Number,
    },
  },
  { _id: false }
);

// Delivery receipt sub-schema
const deliveryReceiptSchema = new Schema<IDeliveryReceipt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

// Main message schema
const messageSchema = new Schema<IMessage>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    chatType: {
      type: String,
      enum: ['private', 'group'],
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'sticker'],
      default: 'text',
    },
    media: {
      type: mediaAttachmentSchema,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent',
    },
    deliveredTo: {
      type: [deliveryReceiptSchema],
      default: [],
    },
    seenBy: {
      type: [deliveryReceiptSchema],
      default: [],
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
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

// Compound index for efficient message retrieval
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, chatType: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, isDeleted: 1, createdAt: -1 });

// Index for unread message queries
messageSchema.index({ chatId: 1, status: 1, createdAt: -1 });

// ===========================================
// VIRTUAL FIELDS
// ===========================================

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function () {
  return this.createdAt?.toISOString();
});

// ===========================================
// STATIC METHODS
// ===========================================

/**
 * Get messages for a chat with pagination
 */
messageSchema.statics.getChatMessages = function (
  chatId: mongoose.Types.ObjectId,
  page = 1,
  limit = 50
) {
  return this.find({
    chatId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('sender', 'displayName avatar username')
    .populate('replyTo', 'content messageType sender');
};

/**
 * Get unread messages count for a user in a chat
 */
messageSchema.statics.getUnreadCount = function (
  chatId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  return this.countDocuments({
    chatId,
    sender: { $ne: userId },
    isDeleted: false,
    'seenBy.userId': { $ne: userId },
  });
};

/**
 * Mark messages as delivered
 */
messageSchema.statics.markAsDelivered = function (
  chatId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  return this.updateMany(
    {
      chatId,
      sender: { $ne: userId },
      'deliveredTo.userId': { $ne: userId },
    },
    {
      $push: {
        deliveredTo: { userId, timestamp: new Date() },
      },
      $set: { status: 'delivered' },
    }
  );
};

/**
 * Mark messages as seen
 */
messageSchema.statics.markAsSeen = function (
  chatId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  return this.updateMany(
    {
      chatId,
      sender: { $ne: userId },
      'seenBy.userId': { $ne: userId },
    },
    {
      $push: {
        seenBy: { userId, timestamp: new Date() },
      },
      $set: { status: 'seen' },
    }
  );
};

/**
 * Soft delete a message
 */
messageSchema.statics.softDelete = function (
  messageId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  deleteForEveryone = false
) {
  if (deleteForEveryone) {
    return this.findByIdAndUpdate(
      messageId,
      { isDeleted: true, content: 'This message was deleted' },
      { new: true }
    );
  }
  return this.findByIdAndUpdate(
    messageId,
    { $addToSet: { deletedFor: userId } },
    { new: true }
  );
};

// Create and export the model
const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;
