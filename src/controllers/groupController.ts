// ===========================================
// PROCONNECT - GROUP CONTROLLER
// Group management API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { groupService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

/**
 * Create a new group
 * POST /api/v1/groups
 */
export const createGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n👥 [GROUP] POST / - Create group');
    console.log('👤 User ID:', req.userId);
    console.log('📥 Group data:', {
      name: req.body.name,
      description: req.body.description?.substring(0, 50),
      membersCount: req.body.members?.length,
    });

    const { name, description, members, avatar } = req.body;
    const group = await groupService.createGroup(
      req.userId!,
      name,
      members,
      description,
      avatar
    );

    console.log('✅ Group created. ID:', group._id, 'Name:', group.name);

    sendCreated(res, 'Group created successfully', { group });
  } catch (error) {
    console.error('❌ [GROUP] Create group error:', (error as Error).message);
    next(error);
  }
};

/**
 * Get user's groups
 * GET /api/v1/groups
 */
export const getUserGroups = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n👥 [GROUP] GET / - Get user groups');
    console.log('👤 User ID:', req.userId);
    console.log('📥 Query params:', req.query);

    const { page = '1', limit = '20' } = req.query;
    const { groups, meta } = await groupService.getUserGroups(
      req.userId!,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    console.log('✅ Retrieved', groups.length, 'groups');

    sendSuccess(res, 'Groups retrieved successfully', { groups }, meta);
  } catch (error) {
    console.error('❌ [GROUP] Get groups error:', (error as Error).message);
    next(error);
  }
};

/**
 * Get group by ID
 * GET /api/v1/groups/:id
 */
export const getGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n👥 [GROUP] GET /:id');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);

    const { id } = req.params;
    const group = await groupService.getGroupById(id, req.userId!);

    console.log('✅ Group retrieved:', group.name);

    sendSuccess(res, 'Group retrieved successfully', { group });
  } catch (error) {
    console.error('❌ [GROUP] Get group error:', (error as Error).message);
    next(error);
  }
};

/**
 * Update group details
 * PATCH /api/v1/groups/:id
 */
export const updateGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n✏️ [GROUP] PATCH /:id - Update group');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);
    console.log('📥 Update data:', JSON.stringify(req.body, null, 2));

    const { id } = req.params;
    const { name, description, avatar, settings } = req.body;
    const group = await groupService.updateGroup(id, req.userId!, {
      name,
      description,
      avatar,
      settings,
    });

    console.log('✅ Group updated:', group.name);

    sendSuccess(res, 'Group updated successfully', { group });
  } catch (error) {
    console.error('❌ [GROUP] Update group error:', (error as Error).message);
    next(error);
  }
};

/**
 * Delete group
 * DELETE /api/v1/groups/:id
 */
export const deleteGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n🗑️ [GROUP] DELETE /:id');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);

    const { id } = req.params;
    await groupService.deleteGroup(id, req.userId!);

    console.log('✅ Group deleted');

    sendSuccess(res, 'Group deleted successfully');
  } catch (error) {
    console.error('❌ [GROUP] Delete group error:', (error as Error).message);
    next(error);
  }
};

/**
 * Add members to group
 * POST /api/v1/groups/:id/members
 */
export const addMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n➕ [GROUP] POST /:id/members');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);
    console.log('📥 Members to add:', req.body.members?.length);

    const { id } = req.params;
    const { members } = req.body;
    const group = await groupService.addMembers(id, req.userId!, members);

    console.log('✅ Members added to group');

    sendSuccess(res, 'Members added successfully', { group });
  } catch (error) {
    console.error('❌ [GROUP] Add members error:', (error as Error).message);
    next(error);
  }
};

/**
 * Remove member from group
 * DELETE /api/v1/groups/:id/members/:memberId
 */
export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n➖ [GROUP] DELETE /:id/members/:memberId');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);
    console.log('🎯 Member ID to remove:', req.params.memberId);

    const { id, memberId } = req.params;
    const group = await groupService.removeMember(id, req.userId!, memberId);

    console.log('✅ Member removed from group');

    sendSuccess(res, 'Member removed successfully', { group });
  } catch (error) {
    console.error('❌ [GROUP] Remove member error:', (error as Error).message);
    next(error);
  }
};

/**
 * Leave group
 * POST /api/v1/groups/:id/leave
 */
export const leaveGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n🚪 [GROUP] POST /:id/leave');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);

    const { id } = req.params;
    const group = await groupService.removeMember(id, req.userId!, req.userId!);

    console.log('✅ User left group');

    sendSuccess(res, 'Left group successfully', { group });
  } catch (error) {
    console.error('❌ [GROUP] Leave group error:', (error as Error).message);
    next(error);
  }
};

/**
 * Update member role
 * PATCH /api/v1/groups/:id/members/:memberId/role
 */
export const updateMemberRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n👑 [GROUP] PATCH /:id/members/:memberId/role');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);
    console.log('🎯 Member ID:', req.params.memberId);
    console.log('📥 New role:', req.body.role);

    const { id, memberId } = req.params;
    const { role } = req.body;
    const group = await groupService.updateMemberRole(id, req.userId!, memberId, role);

    console.log('✅ Member role updated to:', role);

    sendSuccess(res, 'Member role updated successfully', { group });
  } catch (error) {
    console.error('❌ [GROUP] Update member role error:', (error as Error).message);
    next(error);
  }
};

/**
 * Transfer ownership
 * POST /api/v1/groups/:id/transfer-ownership
 */
export const transferOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n👑🔄 [GROUP] POST /:id/transfer-ownership');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);
    console.log('📥 New owner ID:', req.body.newOwnerId);

    const { id } = req.params;
    const { newOwnerId } = req.body;
    const group = await groupService.transferOwnership(id, req.userId!, newOwnerId);

    console.log('✅ Ownership transferred to:', newOwnerId);

    sendSuccess(res, 'Ownership transferred successfully', { group });
  } catch (error) {
    console.error('❌ [GROUP] Transfer ownership error:', (error as Error).message);
    next(error);
  }
};

/**
 * Join group via invite link
 * POST /api/v1/groups/join/:inviteLink
 */
export const joinByInviteLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n🔗 [GROUP] POST /join/:inviteLink');
    console.log('👤 User ID:', req.userId);
    console.log('🔗 Invite link:', req.params.inviteLink);

    const { inviteLink } = req.params;
    const group = await groupService.joinByInviteLink(inviteLink, req.userId!);

    console.log('✅ Joined group via invite link:', group.name);

    sendSuccess(res, 'Joined group successfully', { group });
  } catch (error) {
    console.error('❌ [GROUP] Join by invite error:', (error as Error).message);
    next(error);
  }
};

/**
 * Regenerate invite link
 * POST /api/v1/groups/:id/regenerate-invite
 */
export const regenerateInviteLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n🔗🔄 [GROUP] POST /:id/regenerate-invite');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);
    console.log('📥 Expiry days:', req.body.expiryDays);

    const { id } = req.params;
    const { expiryDays } = req.body;
    const inviteLink = await groupService.regenerateInviteLink(id, req.userId!, expiryDays);

    console.log('✅ Invite link regenerated:', inviteLink);

    sendSuccess(res, 'Invite link regenerated successfully', { inviteLink });
  } catch (error) {
    console.error('❌ [GROUP] Regenerate invite error:', (error as Error).message);
    next(error);
  }
};

/**
 * Mute/unmute member
 * POST /api/v1/groups/:id/members/:memberId/mute
 */
export const muteMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n🔇 [GROUP] POST /:id/members/:memberId/mute');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Group ID:', req.params.id);
    console.log('🎯 Member ID:', req.params.memberId);
    console.log('📥 Mute until:', req.body.muteUntil);

    const { id, memberId } = req.params;
    const { muteUntil } = req.body;
    const group = await groupService.muteMember(
      id,
      req.userId!,
      memberId,
      muteUntil ? new Date(muteUntil) : undefined
    );

    console.log('✅ Member', muteUntil ? 'muted' : 'unmuted');

    sendSuccess(res, muteUntil ? 'Member muted' : 'Member unmuted', { group });
  } catch (error) {
    console.error('❌ [GROUP] Mute member error:', (error as Error).message);
    next(error);
  }
};

export default {
  createGroup,
  getUserGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMember,
  leaveGroup,
  updateMemberRole,
  transferOwnership,
  joinByInviteLink,
  regenerateInviteLink,
  muteMember,
};
