// ===========================================
// PROCONNECT - CALL MODEL
// MongoDB schema for call logs and state
// ===========================================

import mongoose, { Schema } from 'mongoose';
import { ICall, ICallParticipant } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Call participant sub-schema
const callParticipantSchema = new Schema<ICallParticipant>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'ringing', 'joined', 'left', 'rejected', 'missed'],
      default: 'pending',
    },
    joinedAt: {
      type: Date,
    },
    leftAt: {
      type: Date,
    },
  },
  { _id: false }
);

// Main call schema
const callSchema = new Schema<ICall>(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    caller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ['audio', 'video'],
      required: true,
    },
    isGroupCall: {
      type: Boolean,
      default: false,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      sparse: true,
    },
    participants: {
      type: [callParticipantSchema],
      required: true,
      validate: {
        validator: function (v: ICallParticipant[]) {
          return v.length >= 1;
        },
        message: 'Call must have at least 1 participant',
      },
    },
    status: {
      type: String,
      enum: ['initiating', 'ringing', 'accepted', 'rejected', 'ended', 'missed', 'busy', 'failed'],
      default: 'initiating',
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    duration: {
      type: Number, // In seconds
      default: 0,
    },
    endReason: {
      type: String,
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

callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ 'participants.userId': 1, createdAt: -1 });
callSchema.index({ groupId: 1, createdAt: -1 }, { sparse: true });
callSchema.index({ status: 1, createdAt: -1 });
callSchema.index({ callId: 1, status: 1 });

// ===========================================
// VIRTUAL FIELDS
// ===========================================

// Formatted duration
callSchema.virtual('formattedDuration').get(function () {
  if (!this.duration) return '00:00';
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

// ===========================================
// STATIC METHODS
// ===========================================

/**
 * Create a new call
 */
callSchema.statics.createCall = async function (
  callerId: mongoose.Types.ObjectId,
  receiverIds: mongoose.Types.ObjectId[],
  callType: 'audio' | 'video',
  groupId?: mongoose.Types.ObjectId
) {
  const participants: ICallParticipant[] = receiverIds.map((userId) => ({
    userId,
    status: 'pending',
  }));

  return this.create({
    callId: uuidv4(),
    caller: callerId,
    callType,
    isGroupCall: !!groupId,
    groupId,
    participants,
    status: 'initiating',
  });
};

/**
 * Update call status
 */
callSchema.statics.updateCallStatus = function (
  callId: string,
  status: string,
  endReason?: string
) {
  const update: Record<string, unknown> = { status };
  
  if (status === 'accepted') {
    update.startedAt = new Date();
  }
  
  if (['ended', 'rejected', 'missed', 'failed'].includes(status)) {
    update.endedAt = new Date();
    if (endReason) {
      update.endReason = endReason;
    }
  }

  return this.findOneAndUpdate({ callId }, update, { new: true });
};

/**
 * Update participant status
 */
callSchema.statics.updateParticipantStatus = function (
  callId: string,
  participantId: mongoose.Types.ObjectId,
  status: string
) {
  const update: Record<string, unknown> = {
    'participants.$.status': status,
  };

  if (status === 'joined') {
    update['participants.$.joinedAt'] = new Date();
  }
  if (['left', 'rejected', 'missed'].includes(status)) {
    update['participants.$.leftAt'] = new Date();
  }

  return this.findOneAndUpdate(
    { callId, 'participants.userId': participantId },
    { $set: update },
    { new: true }
  );
};

/**
 * End call and calculate duration
 */
callSchema.statics.endCall = async function (
  callId: string,
  endReason = 'normal'
) {
  const call = await this.findOne({ callId });
  if (!call) return null;

  const endedAt = new Date();
  let duration = 0;

  if (call.startedAt) {
    duration = Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000);
  }

  return this.findOneAndUpdate(
    { callId },
    {
      status: 'ended',
      endedAt,
      duration,
      endReason,
    },
    { new: true }
  );
};

/**
 * Get call history for a user
 */
callSchema.statics.getCallHistory = function (
  userId: mongoose.Types.ObjectId,
  page = 1,
  limit = 20,
  callType?: 'audio' | 'video'
) {
  const query: Record<string, unknown> = {
    $or: [
      { caller: userId },
      { 'participants.userId': userId },
    ],
    status: { $in: ['ended', 'rejected', 'missed'] },
  };

  if (callType) {
    query.callType = callType;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('caller', 'displayName avatar username')
    .populate('participants.userId', 'displayName avatar username')
    .populate('groupId', 'name avatar');
};

/**
 * Get active call for user
 */
callSchema.statics.getActiveCall = function (userId: mongoose.Types.ObjectId) {
  return this.findOne({
    $or: [
      { caller: userId },
      { 'participants.userId': userId },
    ],
    status: { $in: ['initiating', 'ringing', 'accepted'] },
  })
    .populate('caller', 'displayName avatar username')
    .populate('participants.userId', 'displayName avatar username');
};

/**
 * Get missed calls count for user
 */
callSchema.statics.getMissedCallsCount = function (
  userId: mongoose.Types.ObjectId,
  since?: Date
) {
  const query: Record<string, unknown> = {
    'participants.userId': userId,
    'participants.status': 'missed',
    caller: { $ne: userId },
  };

  if (since) {
    query.createdAt = { $gte: since };
  }

  return this.countDocuments(query);
};

// Create and export the model
const Call = mongoose.model<ICall>('Call', callSchema);

export default Call;
