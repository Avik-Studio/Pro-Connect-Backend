// ===========================================
// PROCONNECT - CALL CONTROLLER
// Audio/Video calling API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { callService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';
import { emitToUser } from '../socket';
import { logger } from '../utils/logger';

/**
 * Initiate a new call
 * POST /api/v1/calls
 */
export const initiateCall = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CALL] POST / - Initiate call');
    logger.debug('Caller ID: %s', req.userId);
    logger.debug('Call data: %o', {
      receiverId: req.body.receiverId,
      groupId: req.body.groupId,
      callType: req.body.callType,
    });

    const { receiverId, groupId, callType } = req.body;
    const receiverIds = groupId ? [] : [receiverId];
    
    const call = await callService.initiateCall(
      req.userId!,
      receiverIds,
      callType,
      groupId
    );

    logger.debug('Call initiated. ID: %s', call._id);
    logger.debug('Call type: %s', callType);
    logger.debug('Receivers: %s', receiverIds.length || 'Group call');

    // Notify receiver(s) via socket
    if (receiverId) {
      emitToUser(receiverId, 'incoming-call', { call });
    }

    sendCreated(res, 'Call initiated successfully', { call });
  } catch (error) {
    logger.error('[CALL] Initiate call error: %s', (error as Error).message);
    next(error);
  }
};

/**
 * Get active call
 * GET /api/v1/calls/active
 */
export const getActiveCall = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CALL] GET /active');
    logger.debug('User ID: %s', req.userId);

    const call = await callService.getActiveCall(req.userId!);

    logger.debug('Active call: %s', call ? `ID: ${call._id}` : 'None');

    sendSuccess(res, call ? 'Active call found' : 'No active call', { call });
  } catch (error) {
    logger.error('[CALL] Get active call error: %s', (error as Error).message);
    next(error);
  }
};

/**
 * Get call by ID
 * GET /api/v1/calls/:callId
 */
export const getCall = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CALL] GET /:callId');
    logger.debug('User ID: %s', req.userId);
    logger.debug('Call ID: %s', req.params.callId);

    const { callId } = req.params;
    const call = await callService.getCallById(callId);

    logger.debug('Call retrieved');

    sendSuccess(res, 'Call retrieved successfully', { call });
  } catch (error) {
    logger.error('[CALL] Get call error: %s', (error as Error).message);
    next(error);
  }
};

/**
 * Accept a call
 * POST /api/v1/calls/:callId/accept
 */
export const acceptCall = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CALL] POST /:callId/accept');
    logger.debug('User ID: %s', req.userId);
    logger.debug('Call ID: %s', req.params.callId);

    const { callId } = req.params;
    const call = await callService.acceptCall(callId, req.userId!);

    logger.debug('Call accepted');

    // Notify caller that the call was accepted
    if (call.caller) {
      const callerId = call.caller.toString();
      if (callerId) {
        emitToUser(callerId, 'call-accepted', { callId, acceptedBy: req.userId });
      }
    }

    sendSuccess(res, 'Call accepted', { call });
  } catch (error) {
    logger.error('[CALL] Accept call error: %s', (error as Error).message);
    next(error);
  }
};

/**
 * Reject a call
 * POST /api/v1/calls/:callId/reject
 */
export const rejectCall = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CALL] POST /:callId/reject');
    logger.debug('User ID: %s', req.userId);
    logger.debug('Call ID: %s', req.params.callId);
    logger.debug('Reason: %s', req.body.reason || 'Not specified');

    const { callId } = req.params;
    const { reason } = req.body;
    const call = await callService.rejectCall(callId, req.userId!, reason);

    logger.debug('Call rejected');

    // Notify caller that the call was rejected
    if (call.caller) {
      const callerId = call.caller.toString();
      if (callerId) {
        emitToUser(callerId, 'call-rejected', { callId, rejectedBy: req.userId, reason });
      }
    }

    sendSuccess(res, 'Call rejected', { call });
  } catch (error) {
    logger.error('[CALL] Reject call error: %s', (error as Error).message);
    next(error);
  }
};

/**
 * End a call
 * POST /api/v1/calls/:callId/end
 */
export const endCall = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CALL] POST /:callId/end');
    logger.debug('User ID: %s', req.userId);
    logger.debug('Call ID: %s', req.params.callId);
    logger.debug('End reason: %s', req.body.reason || 'normal');

    const { callId } = req.params;
    const { reason } = req.body;
    const call = await callService.endCall(callId, req.userId!, reason);

    logger.debug('Call ended');

    // Notify all participants that the call ended
    if (call.participants) {
      for (const participant of call.participants) {
        const pid = participant.userId?.toString();
        if (pid && pid !== req.userId) {
          emitToUser(pid, 'call-ended', { callId, endedBy: req.userId, reason });
        }
      }
    }

    sendSuccess(res, 'Call ended', { call });
  } catch (error) {
    logger.error('[CALL] End call error: %s', (error as Error).message);
    next(error);
  }
};

/**
 * Leave a call (for group calls)
 * POST /api/v1/calls/:callId/leave
 */
export const leaveCall = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CALL] POST /:callId/leave');
    logger.debug('User ID: %s', req.userId);
    logger.debug('Call ID: %s', req.params.callId);

    const { callId } = req.params;
    const call = await callService.leaveCall(callId, req.userId!);

    logger.debug('Left call');

    sendSuccess(res, 'Left call', { call });
  } catch (error) {
    logger.error('[CALL] Leave call error: %s', (error as Error).message);
    next(error);
  }
};

/**
 * Get call history
 * GET /api/v1/calls/history
 */
export const getCallHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CALL] GET /history');
    logger.debug('User ID: %s', req.userId);
    logger.debug('Query params: %o', req.query);

    const { page = '1', limit = '20', type } = req.query;
    const { calls, meta } = await callService.getCallHistory(
      req.userId!,
      parseInt(page as string, 10),
      parseInt(limit as string, 10),
      type as 'audio' | 'video' | undefined
    );

    logger.debug('Retrieved %s calls', calls.length);

    sendSuccess(res, 'Call history retrieved successfully', { calls }, meta);
  } catch (error) {
    logger.error('[CALL] Get call history error: %s', (error as Error).message);
    next(error);
  }
};

/**
 * Get missed calls count
 * GET /api/v1/calls/missed-count
 */
export const getMissedCallsCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('[CALL] GET /missed-count');
    logger.debug('User ID: %s', req.userId);
    logger.debug('Since: %s', req.query.since || 'All time');

    const { since } = req.query;
    const count = await callService.getMissedCallsCount(
      req.userId!,
      since ? new Date(since as string) : undefined
    );

    logger.debug('Missed calls count: %s', count);

    sendSuccess(res, 'Missed calls count retrieved', { count });
  } catch (error) {
    logger.error('[CALL] Get missed calls error: %s', (error as Error).message);
    next(error);
  }
};

export default {
  initiateCall,
  getActiveCall,
  getCall,
  acceptCall,
  rejectCall,
  endCall,
  leaveCall,
  getCallHistory,
  getMissedCallsCount,
};
