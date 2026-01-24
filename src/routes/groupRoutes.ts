// ===========================================
// PROCONNECT - GROUP ROUTES
// Group management API endpoints with Swagger docs
// ===========================================

import { Router } from 'express';
import { groupController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  members: z.array(z.string()).min(1, 'At least one member is required').max(256),
});

const updateGroupSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  settings: z.object({
    onlyAdminsCanPost: z.boolean().optional(),
    onlyAdminsCanEditInfo: z.boolean().optional(),
    onlyAdminsCanAddMembers: z.boolean().optional(),
    approvalRequired: z.boolean().optional(),
    muteAllMembers: z.boolean().optional(),
    maxMembers: z.number().min(2).max(1000).optional(),
  }).optional(),
});

const addMembersSchema = z.object({
  members: z.array(z.string()).min(1).max(100),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1, 'New owner ID is required'),
});

const regenerateInviteSchema = z.object({
  expiryDays: z.number().min(1).max(365).optional(),
});

const muteSchema = z.object({
  muteUntil: z.string().datetime().optional(),
});

const paginationSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

// ===========================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ===========================================

router.use(authenticate);

// ===========================================
// SWAGGER DOCUMENTATION & ROUTES
// ===========================================

/**
 * @swagger
 * /groups:
 *   post:
 *     summary: Create a new group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - members
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Project Team
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               avatar:
 *                 type: string
 *                 format: uri
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 256
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     group:
 *                       $ref: '#/components/schemas/Group'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', validateBody(createGroupSchema), groupController.createGroup);

/**
 * @swagger
 * /groups:
 *   get:
 *     summary: Get all groups for current user
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Groups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     groups:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Group'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', validateQuery(paginationSchema), groupController.getUserGroups);

/**
 * @swagger
 * /groups/{id}:
 *   get:
 *     summary: Get group by ID
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', groupController.getGroup);

/**
 * @swagger
 * /groups/{id}:
 *   patch:
 *     summary: Update group details (Admin/Owner only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: uri
 *               settings:
 *                 type: object
 *                 properties:
 *                   onlyAdminsCanPost:
 *                     type: boolean
 *                   onlyAdminsCanAddMembers:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Group updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to update group
 */
router.patch('/:id', validateBody(updateGroupSchema), groupController.updateGroup);

/**
 * @swagger
 * /groups/{id}:
 *   delete:
 *     summary: Delete group (Owner only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Only owner can delete the group
 */
router.delete('/:id', groupController.deleteGroup);

/**
 * @swagger
 * /groups/{id}/members:
 *   post:
 *     summary: Add members to group (Admin/Owner only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - members
 *             properties:
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to add
 *     responses:
 *       200:
 *         description: Members added successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to add members
 */
router.post('/:id/members', validateBody(addMembersSchema), groupController.addMembers);

/**
 * @swagger
 * /groups/{id}/members/{memberId}:
 *   delete:
 *     summary: Remove member from group (Admin/Owner only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to remove members
 */
router.delete('/:id/members/:memberId', groupController.removeMember);

/**
 * @swagger
 * /groups/{id}/leave:
 *   post:
 *     summary: Leave group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Left group successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/leave', groupController.leaveGroup);

/**
 * @swagger
 * /groups/{id}/members/{memberId}/role:
 *   patch:
 *     summary: Update member role (Owner only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Only owner can change roles
 */
router.patch(
  '/:id/members/:memberId/role',
  validateBody(updateRoleSchema),
  groupController.updateMemberRole
);

/**
 * @swagger
 * /groups/{id}/members/{memberId}/mute:
 *   post:
 *     summary: Mute or unmute a member (Admin/Owner only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               muteUntil:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Member muted/unmuted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/:id/members/:memberId/mute',
  validateBody(muteSchema),
  groupController.muteMember
);

/**
 * @swagger
 * /groups/{id}/transfer-ownership:
 *   post:
 *     summary: Transfer group ownership (Owner only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newOwnerId
 *             properties:
 *               newOwnerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ownership transferred successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Only owner can transfer ownership
 */
router.post(
  '/:id/transfer-ownership',
  validateBody(transferOwnershipSchema),
  groupController.transferOwnership
);

/**
 * @swagger
 * /groups/join/{inviteLink}:
 *   post:
 *     summary: Join group via invite link
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inviteLink
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Joined group successfully
 *       400:
 *         description: Invalid or expired invite link
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/join/:inviteLink', groupController.joinByInviteLink);

/**
 * @swagger
 * /groups/{id}/regenerate-invite:
 *   post:
 *     summary: Regenerate group invite link (Admin/Owner only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiryDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *     responses:
 *       200:
 *         description: Invite link regenerated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     inviteLink:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/:id/regenerate-invite',
  validateBody(regenerateInviteSchema),
  groupController.regenerateInviteLink
);

export default router;
