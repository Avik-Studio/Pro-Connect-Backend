// ===========================================
// PROCONNECT - GROUP MODEL
// MongoDB schema for group chat management
// ===========================================

import mongoose, { Schema } from 'mongoose';
import { IGroup, IGroupMember, IGroupSettings } from '../types';
import { generateInviteCode } from '../utils/helpers';

// Group member sub-schema
const groupMemberSchema = new Schema<IGroupMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    nickname: {
      type: String,
      maxlength: 30,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    mutedUntil: {
      type: Date,
    },
  },
  { _id: false }
);

// Group settings sub-schema
const groupSettingsSchema = new Schema<IGroupSettings>(
  {
    isPublic: {
      type: Boolean,
      default: false,
    },
    allowMemberInvites: {
      type: Boolean,
      default: true,
    },
    allowMemberMessages: {
      type: Boolean,
      default: true,
    },
    maxMembers: {
      type: Number,
      default: 256,
      max: 1024,
    },
    messageRetention: {
      type: Number, // Days, 0 = forever
      default: 0,
    },
  },
  { _id: false }
);

// Main group schema
const groupSchema = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [2, 'Group name must be at least 2 characters'],
      maxlength: [100, 'Group name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    avatar: {
      type: String,
      default: null,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: {
      type: [groupMemberSchema],
      validate: {
        validator: function (v: IGroupMember[]) {
          return v.length >= 1;
        },
        message: 'Group must have at least 1 member',
      },
    },
    settings: {
      type: groupSettingsSchema,
      default: () => ({}),
    },
    inviteLink: {
      type: String,
      unique: true,
      sparse: true,
    },
    inviteLinkExpiry: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
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

groupSchema.index({ owner: 1 });
groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ inviteLink: 1 }, { sparse: true });
groupSchema.index({ isActive: 1, createdAt: -1 });
groupSchema.index({ name: 'text', description: 'text' });

// ===========================================
// VIRTUAL FIELDS
// ===========================================

// Get member count
groupSchema.virtual('memberCount').get(function () {
  return this.members?.length || 0;
});

// ===========================================
// STATIC METHODS
// ===========================================

/**
 * Create a new group
 */
groupSchema.statics.createGroup = async function (
  name: string,
  ownerId: mongoose.Types.ObjectId,
  memberIds: mongoose.Types.ObjectId[] = [],
  description?: string,
  avatar?: string
) {
  // Ensure owner is included in members
  const allMemberIds = [ownerId, ...memberIds.filter((id) => !id.equals(ownerId))];

  const members: IGroupMember[] = allMemberIds.map((userId, index) => ({
    userId,
    role: index === 0 ? 'owner' : 'member',
    joinedAt: new Date(),
    addedBy: index === 0 ? undefined : ownerId,
    isMuted: false,
  }));

  return this.create({
    name,
    description,
    avatar,
    owner: ownerId,
    members,
    inviteLink: generateInviteCode(),
  });
};

/**
 * Get groups for a user
 */
groupSchema.statics.getUserGroups = function (
  userId: mongoose.Types.ObjectId,
  page = 1,
  limit = 20
) {
  return this.find({
    'members.userId': userId,
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('members.userId', 'displayName avatar username isOnline');
};

/**
 * Get group by invite link
 */
groupSchema.statics.getByInviteLink = function (inviteLink: string) {
  return this.findOne({
    inviteLink,
    isActive: true,
    $or: [
      { inviteLinkExpiry: null },
      { inviteLinkExpiry: { $gt: new Date() } },
    ],
  });
};

/**
 * Add member to group
 */
groupSchema.statics.addMember = async function (
  groupId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  addedBy?: mongoose.Types.ObjectId,
  role: 'admin' | 'member' = 'member'
) {
  const group = await this.findById(groupId);
  if (!group) return null;

  // Check if already a member
  const existingMember = group.members.find(
    (m: IGroupMember) => m.userId.equals(userId)
  );
  if (existingMember) return group;

  // Check max members
  if (group.members.length >= group.settings.maxMembers) {
    throw new Error('Group has reached maximum member limit');
  }

  return this.findByIdAndUpdate(
    groupId,
    {
      $push: {
        members: {
          userId,
          role,
          joinedAt: new Date(),
          addedBy,
          isMuted: false,
        },
      },
    },
    { new: true }
  );
};

/**
 * Remove member from group
 */
groupSchema.statics.removeMember = function (
  groupId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  return this.findByIdAndUpdate(
    groupId,
    {
      $pull: { members: { userId } },
    },
    { new: true }
  );
};

/**
 * Update member role
 */
groupSchema.statics.updateMemberRole = async function (
  groupId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  newRole: 'admin' | 'member'
) {
  return this.findOneAndUpdate(
    { _id: groupId, 'members.userId': userId },
    { $set: { 'members.$.role': newRole } },
    { new: true }
  );
};

/**
 * Check if user is member
 */
groupSchema.statics.isMember = async function (
  groupId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<boolean> {
  const group = await this.findOne({
    _id: groupId,
    'members.userId': userId,
    isActive: true,
  });
  return !!group;
};

/**
 * Check if user is admin or owner
 */
groupSchema.statics.isAdminOrOwner = async function (
  groupId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<boolean> {
  const group = await this.findOne({
    _id: groupId,
    members: {
      $elemMatch: {
        userId,
        role: { $in: ['owner', 'admin'] },
      },
    },
    isActive: true,
  });
  return !!group;
};

/**
 * Regenerate invite link
 */
groupSchema.statics.regenerateInviteLink = function (
  groupId: mongoose.Types.ObjectId,
  expiryDays?: number
) {
  const update: { inviteLink: string; inviteLinkExpiry?: Date | null } = {
    inviteLink: generateInviteCode(),
  };

  if (expiryDays) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expiryDays);
    update.inviteLinkExpiry = expiry;
  } else {
    update.inviteLinkExpiry = null;
  }

  return this.findByIdAndUpdate(groupId, update, { new: true });
};

// Create and export the model
const Group = mongoose.model<IGroup>('Group', groupSchema);

export default Group;
