// ===========================================
// PROCONNECT - CALL CONTROLLER
// Audio/Video calling API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { callService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

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
    console.log('\n📞 [CALL] POST / - Initiate call');
    console.log('👤 Caller ID:', req.userId);
    console.log('📥 Call data:', {
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

    console.log('✅ Call initiated. ID:', call._id);
    console.log('📞 Call type:', callType);
    console.log('🎯 Receivers:', receiverIds.length || 'Group call');
    
    sendCreated(res, 'Call initiated successfully', { call });
  } catch (error) {
    console.error('❌ [CALL] Initiate call error:', (error as Error).message);
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
    console.log('\n📞 [CALL] GET /active');
    console.log('👤 User ID:', req.userId);

    const call = await callService.getActiveCall(req.userId!);

    console.log('✅ Active call:', call ? `ID: ${call._id}` : 'None');

    sendSuccess(res, call ? 'Active call found' : 'No active call', { call });
  } catch (error) {
    console.error('❌ [CALL] Get active call error:', (error as Error).message);
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
    console.log('\n📞 [CALL] GET /:callId');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Call ID:', req.params.callId);

    const { callId } = req.params;
    const call = await callService.getCallById(callId);

    console.log('✅ Call retrieved');

    sendSuccess(res, 'Call retrieved successfully', { call });
  } catch (error) {
    console.error('❌ [CALL] Get call error:', (error as Error).message);
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
    console.log('\n✅ [CALL] POST /:callId/accept');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Call ID:', req.params.callId);

    const { callId } = req.params;
    const call = await callService.acceptCall(callId, req.userId!);

    console.log('✅ Call accepted');

    sendSuccess(res, 'Call accepted', { call });
  } catch (error) {
    console.error('❌ [CALL] Accept call error:', (error as Error).message);
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
    console.log('\n❌ [CALL] POST /:callId/reject');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Call ID:', req.params.callId);
    console.log('📥 Reason:', req.body.reason || 'Not specified');

    const { callId } = req.params;
    const { reason } = req.body;
    const call = await callService.rejectCall(callId, req.userId!, reason);

    console.log('✅ Call rejected');

    sendSuccess(res, 'Call rejected', { call });
  } catch (error) {
    console.error('❌ [CALL] Reject call error:', (error as Error).message);
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
    console.log('\n🔚 [CALL] POST /:callId/end');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Call ID:', req.params.callId);
    console.log('📥 End reason:', req.body.reason || 'normal');

    const { callId } = req.params;
    const { reason } = req.body;
    const call = await callService.endCall(callId, req.userId!, reason);

    console.log('✅ Call ended');

    sendSuccess(res, 'Call ended', { call });
  } catch (error) {
    console.error('❌ [CALL] End call error:', (error as Error).message);
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
    console.log('\n🚪 [CALL] POST /:callId/leave');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Call ID:', req.params.callId);

    const { callId } = req.params;
    const call = await callService.leaveCall(callId, req.userId!);

    console.log('✅ Left call');

    sendSuccess(res, 'Left call', { call });
  } catch (error) {
    console.error('❌ [CALL] Leave call error:', (error as Error).message);
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
    console.log('\n📋 [CALL] GET /history');
    console.log('👤 User ID:', req.userId);
    console.log('📥 Query params:', req.query);

    const { page = '1', limit = '20', type } = req.query;
    const { calls, meta } = await callService.getCallHistory(
      req.userId!,
      parseInt(page as string, 10),
      parseInt(limit as string, 10),
      type as 'audio' | 'video' | undefined
    );

    console.log('✅ Retrieved', calls.length, 'calls');

    sendSuccess(res, 'Call history retrieved successfully', { calls }, meta);
  } catch (error) {
    console.error('❌ [CALL] Get call history error:', (error as Error).message);
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
    console.log('\n📵 [CALL] GET /missed-count');
    console.log('👤 User ID:', req.userId);
    console.log('📥 Since:', req.query.since || 'All time');

    const { since } = req.query;
    const count = await callService.getMissedCallsCount(
      req.userId!,
      since ? new Date(since as string) : undefined
    );

    console.log('✅ Missed calls count:', count);

    sendSuccess(res, 'Missed calls count retrieved', { count });
  } catch (error) {
    console.error('❌ [CALL] Get missed calls error:', (error as Error).message);
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
