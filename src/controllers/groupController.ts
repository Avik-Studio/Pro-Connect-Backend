// ===========================================
// PROCONNECT - GROUP CONTROLLER
// Group management API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { groupService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';
import { logger } from '../utils/logger';

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
    logger.debug('[GROUP] POST / - Create group');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug({
      name: req.body.name,
      description: req.body.description?.substring(0, 50),
      membersCount: req.body.members?.length,
    }, 'Group data');

    const { name, description, members, avatar } = req.body;
    const group = await groupService.createGroup(
      req.userId!,
      name,
      members,
      description,
      avatar
    );

    logger.debug(`Group created. ID: ${group._id} Name: ${group.name}`);

    sendCreated(res, 'Group created successfully', { group });
  } catch (error) {
    logger.error(`[GROUP] Create group error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] GET / - Get user groups');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(req.query, 'Query params');

    const { page = '1', limit = '20' } = req.query;
    const { groups, meta } = await groupService.getUserGroups(
      req.userId!,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    logger.debug(`Retrieved ${groups.length} groups`);

    sendSuccess(res, 'Groups retrieved successfully', { groups }, meta);
  } catch (error) {
    logger.error(`[GROUP] Get groups error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] GET /:id');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);

    const { id } = req.params;
    const group = await groupService.getGroupById(id, req.userId!);

    logger.debug(`Group retrieved: ${group.name}`);

    sendSuccess(res, 'Group retrieved successfully', { group });
  } catch (error) {
    logger.error(`[GROUP] Get group error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] PATCH /:id - Update group');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);
    logger.debug(`Update data: ${JSON.stringify(req.body, null, 2)}`);

    const { id } = req.params;
    const { name, description, avatar, settings } = req.body;
    const group = await groupService.updateGroup(id, req.userId!, {
      name,
      description,
      avatar,
      settings,
    });

    logger.debug(`Group updated: ${group.name}`);

    sendSuccess(res, 'Group updated successfully', { group });
  } catch (error) {
    logger.error(`[GROUP] Update group error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] DELETE /:id');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);

    const { id } = req.params;
    await groupService.deleteGroup(id, req.userId!);

    logger.debug('Group deleted');

    sendSuccess(res, 'Group deleted successfully');
  } catch (error) {
    logger.error(`[GROUP] Delete group error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] POST /:id/members');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);
    logger.debug(`Members to add: ${req.body.members?.length}`);

    const { id } = req.params;
    const { members } = req.body;
    const group = await groupService.addMembers(id, req.userId!, members);

    logger.debug('Members added to group');

    sendSuccess(res, 'Members added successfully', { group });
  } catch (error) {
    logger.error(`[GROUP] Add members error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] DELETE /:id/members/:memberId');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);
    logger.debug(`Member ID to remove: ${req.params.memberId}`);

    const { id, memberId } = req.params;
    const group = await groupService.removeMember(id, req.userId!, memberId);

    logger.debug('Member removed from group');

    sendSuccess(res, 'Member removed successfully', { group });
  } catch (error) {
    logger.error(`[GROUP] Remove member error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] POST /:id/leave');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);

    const { id } = req.params;
    const group = await groupService.removeMember(id, req.userId!, req.userId!);

    logger.debug('User left group');

    sendSuccess(res, 'Left group successfully', { group });
  } catch (error) {
    logger.error(`[GROUP] Leave group error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] PATCH /:id/members/:memberId/role');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);
    logger.debug(`Member ID: ${req.params.memberId}`);
    logger.debug(`New role: ${req.body.role}`);

    const { id, memberId } = req.params;
    const { role } = req.body;
    const group = await groupService.updateMemberRole(id, req.userId!, memberId, role);

    logger.debug(`Member role updated to: ${role}`);

    sendSuccess(res, 'Member role updated successfully', { group });
  } catch (error) {
    logger.error(`[GROUP] Update member role error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] POST /:id/transfer-ownership');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);
    logger.debug(`New owner ID: ${req.body.newOwnerId}`);

    const { id } = req.params;
    const { newOwnerId } = req.body;
    const group = await groupService.transferOwnership(id, req.userId!, newOwnerId);

    logger.debug(`Ownership transferred to: ${newOwnerId}`);

    sendSuccess(res, 'Ownership transferred successfully', { group });
  } catch (error) {
    logger.error(`[GROUP] Transfer ownership error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] POST /join/:inviteLink');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Invite link: ${req.params.inviteLink}`);

    const { inviteLink } = req.params;
    const group = await groupService.joinByInviteLink(inviteLink, req.userId!);

    logger.debug(`Joined group via invite link: ${group.name}`);

    sendSuccess(res, 'Joined group successfully', { group });
  } catch (error) {
    logger.error(`[GROUP] Join by invite error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] POST /:id/regenerate-invite');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);
    logger.debug(`Expiry days: ${req.body.expiryDays}`);

    const { id } = req.params;
    const { expiryDays } = req.body;
    const inviteLink = await groupService.regenerateInviteLink(id, req.userId!, expiryDays);

    logger.debug(`Invite link regenerated: ${inviteLink}`);

    sendSuccess(res, 'Invite link regenerated successfully', { inviteLink });
  } catch (error) {
    logger.error(`[GROUP] Regenerate invite error: ${(error as Error).message}`);
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
    logger.debug('[GROUP] POST /:id/members/:memberId/mute');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Group ID: ${req.params.id}`);
    logger.debug(`Member ID: ${req.params.memberId}`);
    logger.debug(`Mute until: ${req.body.muteUntil}`);

    const { id, memberId } = req.params;
    const { muteUntil } = req.body;
    const group = await groupService.muteMember(
      id,
      req.userId!,
      memberId,
      muteUntil ? new Date(muteUntil) : undefined
    );

    logger.debug(`Member ${muteUntil ? 'muted' : 'unmuted'}`);

    sendSuccess(res, muteUntil ? 'Member muted' : 'Member unmuted', { group });
  } catch (error) {
    logger.error(`[GROUP] Mute member error: ${(error as Error).message}`);
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
