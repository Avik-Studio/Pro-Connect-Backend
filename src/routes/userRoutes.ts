// ===========================================
// PROCONNECT - USER ROUTES
// User management API endpoints with Swagger docs
// ===========================================

import { Router } from 'express';
import { userController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { apiLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  phoneNumber: z.string().optional(),
});

const updateSettingsSchema = z.object({
  notifications: z.object({
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    messagePreview: z.boolean().optional(),
    sound: z.boolean().optional(),
    vibration: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    showOnlineStatus: z.boolean().optional(),
    showLastSeen: z.boolean().optional(),
    showReadReceipts: z.boolean().optional(),
    profilePhotoVisibility: z.enum(['everyone', 'contacts', 'nobody']).optional(),
    aboutVisibility: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  }).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
});

const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
});

const fcmTokenSchema = z.object({
  fcmToken: z.string().min(1, 'FCM token is required'),
});

const onlineStatusSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
});

const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
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
 * /users/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profile', userController.getProfile);

/**
 * @swagger
 * /users/profile:
 *   patch:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               avatar:
 *                 type: string
 *                 format: uri
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.patch('/profile', validateBody(updateProfileSchema), userController.updateProfile);

/**
 * @swagger
 * /users/settings:
 *   patch:
 *     summary: Update user settings
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifications:
 *                 type: object
 *                 properties:
 *                   push:
 *                     type: boolean
 *                   email:
 *                     type: boolean
 *                   messagePreview:
 *                     type: boolean
 *               privacy:
 *                 type: object
 *                 properties:
 *                   showOnlineStatus:
 *                     type: boolean
 *                   showLastSeen:
 *                     type: boolean
 *               theme:
 *                 type: string
 *                 enum: [light, dark, system]
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.patch('/settings', validateBody(updateSettingsSchema), userController.updateSettings);

/**
 * @swagger
 * /users/username:
 *   patch:
 *     summary: Update username
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 pattern: '^[a-zA-Z0-9_]+$'
 *     responses:
 *       200:
 *         description: Username updated successfully
 *       400:
 *         description: Username already taken
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.patch('/username', validateBody(updateUsernameSchema), userController.updateUsername);

/**
 * @swagger
 * /users/search:
 *   get:
 *     summary: Search users by username or display name
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
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
 *         description: Users found
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/search',
  apiLimiter,
  validateQuery(searchQuerySchema),
  userController.searchUsers
);

/**
 * @swagger
 * /users/fcm-token:
 *   post:
 *     summary: Add FCM token for push notifications
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: FCM token added successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/fcm-token', validateBody(fcmTokenSchema), userController.addFcmToken);

/**
 * @swagger
 * /users/fcm-token:
 *   delete:
 *     summary: Remove FCM token
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: FCM token removed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/fcm-token', validateBody(fcmTokenSchema), userController.removeFcmToken);

/**
 * @swagger
 * /users/online-status:
 *   post:
 *     summary: Get online status for multiple users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 100
 *     responses:
 *       200:
 *         description: Online statuses retrieved
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
 *                     statuses:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           isOnline:
 *                             type: boolean
 *                           lastSeen:
 *                             type: string
 *                             format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/online-status', validateBody(onlineStatusSchema), userController.getOnlineStatus);

/**
 * @swagger
 * /users/account:
 *   delete:
 *     summary: Delete user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/account', userController.deleteAccount);

/**
 * @swagger
 * /users/username/{username}:
 *   get:
 *     summary: Get user by username
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User found
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/username/:username', userController.getUserByUsername);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
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
 *         description: User found
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', userController.getUserById);

export default router;
