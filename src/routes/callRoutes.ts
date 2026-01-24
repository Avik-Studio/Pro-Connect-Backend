// ===========================================
// PROCONNECT - CALL ROUTES
// Audio/Video calling API endpoints with Swagger docs
// ===========================================

import { Router } from 'express';
import { callController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const initiateCallSchema = z.object({
  receiverId: z.string().optional(),
  groupId: z.string().optional(),
  callType: z.enum(['audio', 'video']),
}).refine(
  data => data.receiverId || data.groupId,
  { message: 'Either receiverId or groupId is required' }
);

const rejectCallSchema = z.object({
  reason: z.enum(['busy', 'declined']).optional(),
});

const endCallSchema = z.object({
  reason: z.enum(['normal', 'busy', 'failed', 'no_answer', 'declined', 'network_error']).optional(),
});

const callHistoryQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  type: z.enum(['audio', 'video']).optional(),
});

const missedCallsQuerySchema = z.object({
  since: z.string().datetime().optional(),
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
 * /calls:
 *   post:
 *     summary: Initiate a new call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callType
 *             properties:
 *               receiverId:
 *                 type: string
 *                 description: User ID for 1-on-1 call
 *               groupId:
 *                 type: string
 *                 description: Group ID for group call
 *               callType:
 *                 type: string
 *                 enum: [audio, video]
 *     responses:
 *       201:
 *         description: Call initiated successfully
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
 *                     call:
 *                       $ref: '#/components/schemas/Call'
 *       400:
 *         description: Either receiverId or groupId is required
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', validateBody(initiateCallSchema), callController.initiateCall);

/**
 * @swagger
 * /calls/active:
 *   get:
 *     summary: Get current active call for user
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active call retrieved (or null if none)
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
 *                     call:
 *                       $ref: '#/components/schemas/Call'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/active', callController.getActiveCall);

/**
 * @swagger
 * /calls/history:
 *   get:
 *     summary: Get call history
 *     tags: [Calls]
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
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [audio, video]
 *         description: Filter by call type
 *     responses:
 *       200:
 *         description: Call history retrieved
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
 *                     calls:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Call'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/history', validateQuery(callHistoryQuerySchema), callController.getCallHistory);

/**
 * @swagger
 * /calls/missed-count:
 *   get:
 *     summary: Get missed calls count
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Count missed calls since this time
 *     responses:
 *       200:
 *         description: Missed calls count retrieved
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/missed-count',
  validateQuery(missedCallsQuerySchema),
  callController.getMissedCallsCount
);

/**
 * @swagger
 * /calls/{callId}:
 *   get:
 *     summary: Get call by ID
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Call retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:callId', callController.getCall);

/**
 * @swagger
 * /calls/{callId}/accept:
 *   post:
 *     summary: Accept an incoming call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Call accepted
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
 *                     call:
 *                       $ref: '#/components/schemas/Call'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:callId/accept', callController.acceptCall);

/**
 * @swagger
 * /calls/{callId}/reject:
 *   post:
 *     summary: Reject an incoming call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [busy, declined]
 *     responses:
 *       200:
 *         description: Call rejected
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:callId/reject', validateBody(rejectCallSchema), callController.rejectCall);

/**
 * @swagger
 * /calls/{callId}/end:
 *   post:
 *     summary: End an active call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [normal, busy, failed, no_answer, declined, network_error]
 *     responses:
 *       200:
 *         description: Call ended
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:callId/end', validateBody(endCallSchema), callController.endCall);

/**
 * @swagger
 * /calls/{callId}/leave:
 *   post:
 *     summary: Leave a group call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Left call successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:callId/leave', callController.leaveCall);

export default router;
