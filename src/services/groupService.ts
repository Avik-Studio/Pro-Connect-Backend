// ===========================================
// PROCONNECT - GROUP SERVICE
// Group management business logic
// ===========================================

import { Types } from 'mongoose';
import { Group, Conversation, User } from '../models';
import { IGroup, IGroupMember, IGroupSettings, IPaginationMeta, GroupRole } from '../types';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors';
import { generatePaginationMeta, toObjectId } from '../utils/helpers';

/**
 * Create a new group
 */
export const createGroup = async (
  creatorId: string,
  name: string,
  memberIds: string[],
  description?: string,
  avatar?: string
): Promise<IGroup> => {
  // Validate member count
  if (memberIds.length < 1) {
    throw new BadRequestError('Group must have at least one other member');
  }

  // Verify all members exist
  const members = await User.find({
    _id: { $in: memberIds.map((id) => toObjectId(id)) },
    status: 'active',
  });

  if (members.length !== memberIds.length) {
    throw new BadRequestError('One or more members not found');
  }

  // Create group
  const group = await (Group as any).createGroup(
    name,
    toObjectId(creatorId),
    memberIds.map((id) => toObjectId(id)),
    description,
    avatar
  );

  // Create group conversation
  const allMemberIds = [creatorId, ...memberIds].map((id) => toObjectId(id));
  await (Conversation as any).createGroupConversation(group._id, allMemberIds);

  // Populate members
  await group.populate('members.userId', 'displayName avatar username');

  return group;
};

/**
 * Get group by ID
 */
export const getGroupById = async (
  groupId: string,
  userId: string
): Promise<IGroup> => {
  const group = await Group.findById(groupId)
    .populate('members.userId', 'displayName avatar username isOnline lastSeen')
    .populate('owner', 'displayName avatar username');

  if (!group || !group.isActive) {
    throw new NotFoundError('Group not found');
  }

  // Check if user is member
  const isMember = group.members.some(
    (m: IGroupMember) => (m.userId as any)._id.toString() === userId
  );

  if (!isMember) {
    throw new ForbiddenError('You are not a member of this group');
  }

  return group;
};

/**
 * Get user's groups
 */
export const getUserGroups = async (
  userId: string,
  page = 1,
  limit = 20
): Promise<{ groups: IGroup[]; meta: IPaginationMeta }> => {
  const total = await Group.countDocuments({
    'members.userId': toObjectId(userId),
    isActive: true,
  });

  const groups = await (Group as any).getUserGroups(
    toObjectId(userId),
    page,
    limit
  );

  return {
    groups,
    meta: generatePaginationMeta(total, page, limit),
  };
};

/**
 * Update group details
 */
export const updateGroup = async (
  groupId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    avatar?: string | null;
    settings?: Partial<IGroupSettings>;
  }
): Promise<IGroup> => {
  // Check if user is admin or owner
  const isAdmin = await (Group as any).isAdminOrOwner(
    toObjectId(groupId),
    toObjectId(userId)
  );

  if (!isAdmin) {
    throw new ForbiddenError('Only admins can update group details');
  }

  const updateFields: Record<string, any> = {};

  if (updates.name !== undefined) {
    updateFields.name = updates.name;
  }
  if (updates.description !== undefined) {
    updateFields.description = updates.description;
  }
  if (updates.avatar !== undefined) {
    updateFields.avatar = updates.avatar;
  }
  if (updates.settings) {
    Object.entries(updates.settings).forEach(([key, value]) => {
      updateFields[`settings.${key}`] = value;
    });
  }

  const group = await Group.findByIdAndUpdate(
    groupId,
    { $set: updateFields },
    { new: true, runValidators: true }
  ).populate('members.userId', 'displayName avatar username');

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  return group;
};

/**
 * Add members to group
 */
export const addMembers = async (
  groupId: string,
  userId: string,
  memberIds: string[]
): Promise<IGroup> => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    throw new NotFoundError('Group not found');
  }

  // Check permissions
  const isAdmin = await (Group as any).isAdminOrOwner(
    toObjectId(groupId),
    toObjectId(userId)
  );

  const canInvite = isAdmin || group.settings.allowMemberInvites;
  if (!canInvite) {
    throw new ForbiddenError('Only admins can add members to this group');
  }

  // Check member limit
  if (group.members.length + memberIds.length > group.settings.maxMembers) {
    throw new BadRequestError(
      `Cannot add members. Maximum limit is ${group.settings.maxMembers}`
    );
  }

  // Verify members exist
  const newMembers = await User.find({
    _id: { $in: memberIds.map((id) => toObjectId(id)) },
    status: 'active',
  });

  if (newMembers.length !== memberIds.length) {
    throw new BadRequestError('One or more users not found');
  }

  // Add members
  for (const memberId of memberIds) {
    await (Group as any).addMember(
      toObjectId(groupId),
      toObjectId(memberId),
      toObjectId(userId),
      'member'
    );
  }

  // Update conversation participants
  const conversation = await Conversation.findOne({ groupId });
  if (conversation) {
    for (const memberId of memberIds) {
      await (Conversation as any).addParticipant(
        conversation._id,
        toObjectId(memberId)
      );
    }
  }

  const updatedGroup = await Group.findById(groupId)
    .populate('members.userId', 'displayName avatar username');

  return updatedGroup!;
};

/**
 * Remove member from group
 */
export const removeMember = async (
  groupId: string,
  userId: string,
  memberIdToRemove: string
): Promise<IGroup> => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    throw new NotFoundError('Group not found');
  }

  // Can't remove the owner
  if (group.owner.toString() === memberIdToRemove) {
    throw new ForbiddenError('Cannot remove the group owner');
  }

  // Check permissions
  const isAdmin = await (Group as any).isAdminOrOwner(
    toObjectId(groupId),
    toObjectId(userId)
  );

  const isSelfRemoval = userId === memberIdToRemove;

  if (!isAdmin && !isSelfRemoval) {
    throw new ForbiddenError('Only admins can remove members');
  }

  // If admin is removing another admin, must be owner
  const memberToRemove = group.members.find(
    (m: IGroupMember) => m.userId.toString() === memberIdToRemove
  );

  if (memberToRemove?.role === 'admin' && group.owner.toString() !== userId) {
    throw new ForbiddenError('Only the owner can remove admins');
  }

  // Remove member
  await (Group as any).removeMember(
    toObjectId(groupId),
    toObjectId(memberIdToRemove)
  );

  // Update conversation
  const conversation = await Conversation.findOne({ groupId });
  if (conversation) {
    await (Conversation as any).removeParticipant(
      conversation._id,
      toObjectId(memberIdToRemove)
    );
  }

  const updatedGroup = await Group.findById(groupId)
    .populate('members.userId', 'displayName avatar username');

  return updatedGroup!;
};

/**
 * Update member role
 */
export const updateMemberRole = async (
  groupId: string,
  userId: string,
  memberId: string,
  newRole: 'admin' | 'member'
): Promise<IGroup> => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    throw new NotFoundError('Group not found');
  }

  // Only owner can change roles
  if (group.owner.toString() !== userId) {
    throw new ForbiddenError('Only the owner can change member roles');
  }

  // Can't change owner's role
  if (memberId === group.owner.toString()) {
    throw new BadRequestError("Cannot change owner's role");
  }

  // Verify member exists in group
  const memberExists = group.members.some(
    (m: IGroupMember) => m.userId.toString() === memberId
  );

  if (!memberExists) {
    throw new NotFoundError('Member not found in group');
  }

  await (Group as any).updateMemberRole(
    toObjectId(groupId),
    toObjectId(memberId),
    newRole
  );

  const updatedGroup = await Group.findById(groupId)
    .populate('members.userId', 'displayName avatar username');

  return updatedGroup!;
};

/**
 * Transfer group ownership
 */
export const transferOwnership = async (
  groupId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<IGroup> => {
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    throw new NotFoundError('Group not found');
  }

  // Verify current owner
  if (group.owner.toString() !== currentOwnerId) {
    throw new ForbiddenError('Only the owner can transfer ownership');
  }

  // Verify new owner is a member
  const newOwnerMember = group.members.find(
    (m: IGroupMember) => m.userId.toString() === newOwnerId
  );

  if (!newOwnerMember) {
    throw new NotFoundError('New owner must be a group member');
  }

  // Update ownership
  await Group.findByIdAndUpdate(groupId, {
    owner: toObjectId(newOwnerId),
    $set: {
      'members.$[oldOwner].role': 'admin',
      'members.$[newOwner].role': 'owner',
    },
  }, {
    arrayFilters: [
      { 'oldOwner.userId': toObjectId(currentOwnerId) },
      { 'newOwner.userId': toObjectId(newOwnerId) },
    ],
  });

  const updatedGroup = await Group.findById(groupId)
    .populate('members.userId', 'displayName avatar username');

  return updatedGroup!;
};

/**
 * Join group via invite link
 */
export const joinByInviteLink = async (
  inviteLink: string,
  userId: string
): Promise<IGroup> => {
  const group = await (Group as any).getByInviteLink(inviteLink);
  if (!group) {
    throw new NotFoundError('Invalid or expired invite link');
  }

  // Check if already a member
  const isMember = group.members.some(
    (m: IGroupMember) => m.userId.toString() === userId
  );

  if (isMember) {
    throw new ConflictError('You are already a member of this group');
  }

  // Check member limit
  if (group.members.length >= group.settings.maxMembers) {
    throw new BadRequestError('Group has reached maximum member limit');
  }

  // Add member
  await (Group as any).addMember(
    group._id,
    toObjectId(userId),
    undefined,
    'member'
  );

  // Update conversation
  const conversation = await Conversation.findOne({ groupId: group._id });
  if (conversation) {
    await (Conversation as any).addParticipant(conversation._id, toObjectId(userId));
  }

  const updatedGroup = await Group.findById(group._id)
    .populate('members.userId', 'displayName avatar username');

  return updatedGroup!;
};

/**
 * Regenerate invite link
 */
export const regenerateInviteLink = async (
  groupId: string,
  userId: string,
  expiryDays?: number
): Promise<string> => {
  const isAdmin = await (Group as any).isAdminOrOwner(
    toObjectId(groupId),
    toObjectId(userId)
  );

  if (!isAdmin) {
    throw new ForbiddenError('Only admins can regenerate invite link');
  }

  const group = await (Group as any).regenerateInviteLink(
    toObjectId(groupId),
    expiryDays
  );

  return group.inviteLink;
};

/**
 * Delete group
 */
export const deleteGroup = async (
  groupId: string,
  userId: string
): Promise<void> => {
  const group = await Group.findById(groupId);
  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Only owner can delete
  if (group.owner.toString() !== userId) {
    throw new ForbiddenError('Only the owner can delete the group');
  }

  // Soft delete group
  await Group.findByIdAndUpdate(groupId, { isActive: false });

  // Delete conversation
  await Conversation.findOneAndDelete({ groupId });
};

/**
 * Mute/unmute member
 */
export const muteMember = async (
  groupId: string,
  adminId: string,
  memberId: string,
  muteUntil?: Date
): Promise<IGroup> => {
  const isAdmin = await (Group as any).isAdminOrOwner(
    toObjectId(groupId),
    toObjectId(adminId)
  );

  if (!isAdmin) {
    throw new ForbiddenError('Only admins can mute members');
  }

  const group = await Group.findOneAndUpdate(
    { _id: groupId, 'members.userId': toObjectId(memberId) },
    {
      $set: {
        'members.$.isMuted': !!muteUntil,
        'members.$.mutedUntil': muteUntil,
      },
    },
    { new: true }
  ).populate('members.userId', 'displayName avatar username');

  if (!group) {
    throw new NotFoundError('Group or member not found');
  }

  return group;
};

export default {
  createGroup,
  getGroupById,
  getUserGroups,
  updateGroup,
  addMembers,
  removeMember,
  updateMemberRole,
  transferOwnership,
  joinByInviteLink,
  regenerateInviteLink,
  deleteGroup,
  muteMember,
};
