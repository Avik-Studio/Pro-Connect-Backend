// ===========================================
// PROCONNECT - CHAT ROUTES
// Chat and messaging API endpoints with Swagger docs
// ===========================================

import { Router } from 'express';
import { chatController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { apiLimiter, messageLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const privateConversationSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

const sendMessageSchema = z.object({
  content: z.string().max(4000).optional(),
  messageType: z.enum(['text', 'image', 'video', 'audio', 'file', 'location', 'contact']).default('text'),
  media: z.array(z.object({
    url: z.string().url(),
    publicId: z.string().optional(),
    type: z.enum(['image', 'video', 'audio', 'file']).optional(),
    mimeType: z.string(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    duration: z.number().optional(),
    thumbnail: z.string().url().optional(),
  })).optional(),
  replyTo: z.string().optional(),
});

const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const deleteMessageSchema = z.object({
  deleteForEveryone: z.boolean().optional().default(false),
});

const muteSchema = z.object({
  muteUntil: z.string().datetime().optional(),
});

const paginationSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

const searchMessagesSchema = z.object({
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
 * /chat/conversations:
 *   get:
 *     summary: Get all conversations for current user
 *     tags: [Chat]
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
 *         description: Conversations retrieved successfully
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
 *                     conversations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Conversation'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/conversations',
  validateQuery(paginationSchema),
  chatController.getConversations
);

/**
 * @swagger
 * /chat/conversations/private:
 *   post:
 *     summary: Get or create private conversation with a user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user to chat with
 *     responses:
 *       200:
 *         description: Conversation retrieved or created
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
 *                     conversation:
 *                       $ref: '#/components/schemas/Conversation'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/conversations/private',
  validateBody(privateConversationSchema),
  chatController.getOrCreatePrivateConversation
);

/**
 * @swagger
 * /chat/conversations/{id}:
 *   get:
 *     summary: Get conversation by ID
 *     tags: [Chat]
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
 *         description: Conversation retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/conversations/:id', chatController.getConversation);

/**
 * @swagger
 * /chat/conversations/{id}/pin:
 *   post:
 *     summary: Pin or unpin a conversation
 *     tags: [Chat]
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
 *         description: Conversation pinned/unpinned
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/conversations/:id/pin', chatController.togglePin);

/**
 * @swagger
 * /chat/conversations/{id}/mute:
 *   post:
 *     summary: Mute or unmute a conversation
 *     tags: [Chat]
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
 *               muteUntil:
 *                 type: string
 *                 format: date-time
 *                 description: Mute until this time (omit to unmute)
 *     responses:
 *       200:
 *         description: Conversation muted/unmuted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/conversations/:id/mute', validateBody(muteSchema), chatController.muteConversation);

/**
 * @swagger
 * /chat/conversations/{id}/seen:
 *   post:
 *     summary: Mark all messages in conversation as seen
 *     tags: [Chat]
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
 *         description: Messages marked as seen
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/conversations/:id/seen', chatController.markAsSeen);

/**
 * @swagger
 * /chat/conversations/{id}/search:
 *   get:
 *     summary: Search messages in a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Messages found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/conversations/:id/search',
  apiLimiter,
  validateQuery(searchMessagesSchema),
  chatController.searchMessages
);

/**
 * @swagger
 * /chat/conversations/{id}/messages:
 *   get:
 *     summary: Get messages for a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Messages retrieved
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
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Message'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/conversations/:id/messages',
  validateQuery(paginationSchema),
  chatController.getMessages
);

/**
 * @swagger
 * /chat/conversations/{id}/messages:
 *   post:
 *     summary: Send a message to a conversation
 *     tags: [Chat]
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
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 4000
 *               messageType:
 *                 type: string
 *                 enum: [text, image, video, audio, file, location]
 *                 default: text
 *               media:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                     type:
 *                       type: string
 *                     mimeType:
 *                       type: string
 *               replyTo:
 *                 type: string
 *                 description: Message ID to reply to
 *     responses:
 *       201:
 *         description: Message sent successfully
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
 *                     message:
 *                       $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post(
  '/conversations/:id/messages',
  messageLimiter,
  validateBody(sendMessageSchema),
  chatController.sendMessage
);

/**
 * @swagger
 * /chat/messages/{id}:
 *   patch:
 *     summary: Edit a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 4000
 *     responses:
 *       200:
 *         description: Message edited successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to edit this message
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch(
  '/messages/:id',
  validateBody(editMessageSchema),
  chatController.editMessage
);

/**
 * @swagger
 * /chat/messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteForEveryone:
 *                 type: boolean
 *                 default: false
 *                 description: Delete for all participants
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to delete this message
 */
router.delete(
  '/messages/:id',
  validateBody(deleteMessageSchema),
  chatController.deleteMessage
);

/**
 * @swagger
 * /chat/unread-count:
 *   get:
 *     summary: Get total unread message count
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved
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
 *                     count:
 *                       type: integer
 *                       example: 15
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/unread-count', chatController.getUnreadCount);

export default router;
