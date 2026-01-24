// ===========================================
// PROCONNECT - CALL SERVICE
// Audio/Video calling business logic
// ===========================================

import { Types } from 'mongoose';
import { Call, User, Group } from '../models';
import { redis } from '../config/redis';
import { ICall, ICallParticipant, IPaginationMeta, RedisKeys, CallType, CallStatus } from '../types';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors';
import { generatePaginationMeta, toObjectId, calculateDuration } from '../utils/helpers';
import { logCallEvent } from '../utils/logger';

// Call timeout in milliseconds (30 seconds)
const CALL_TIMEOUT = 30000;

/**
 * Initiate a new call
 */
export const initiateCall = async (
  callerId: string,
  receiverIds: string[],
  callType: CallType,
  groupId?: string
): Promise<ICall> => {
  // Check if caller has an active call
  const activeCall = await (Call as any).getActiveCall(toObjectId(callerId));
  if (activeCall) {
    throw new ConflictError('You already have an active call');
  }

  // Verify receivers exist
  const receivers = await User.find({
    _id: { $in: receiverIds.map((id) => toObjectId(id)) },
    status: 'active',
  });

  if (receivers.length !== receiverIds.length) {
    throw new BadRequestError('One or more recipients not found');
  }

  // For group calls, verify group membership
  if (groupId) {
    const group = await Group.findById(groupId);
    if (!group || !group.isActive) {
      throw new NotFoundError('Group not found');
    }

    const isMember = group.members.some(
      (m: any) => m.userId.toString() === callerId
    );
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this group');
    }
  }

  // Create call record
  const call = await (Call as any).createCall(
    toObjectId(callerId),
    receiverIds.map((id) => toObjectId(id)),
    callType,
    groupId ? toObjectId(groupId) : undefined
  );

  // Store call state in Redis
  await redis.setex(
    `${RedisKeys.CALL_STATE}${call.callId}`,
    300, // 5 minutes TTL
    JSON.stringify({
      callId: call.callId,
      callerId,
      receiverIds,
      callType,
      groupId,
      status: 'initiating',
      createdAt: new Date().toISOString(),
    })
  );

  logCallEvent({
    action: 'initiated',
    callId: call.callId,
    callerId,
    receiverId: receiverIds[0],
    groupId,
    callType,
  });

  // Populate and return
  await call.populate([
    { path: 'caller', select: 'displayName avatar username' },
    { path: 'participants.userId', select: 'displayName avatar username' },
  ]);

  return call;
};

/**
 * Update call status to ringing
 */
export const setCallRinging = async (
  callId: string,
  participantId: string
): Promise<ICall> => {
  const call = await (Call as any).updateParticipantStatus(
    callId,
    toObjectId(participantId),
    'ringing'
  );

  if (!call) {
    throw new NotFoundError('Call not found');
  }

  // Update call status if first participant is ringing
  if (call.status === 'initiating') {
    await (Call as any).updateCallStatus(callId, 'ringing');
  }

  // Update Redis state
  const callState = await redis.get(`${RedisKeys.CALL_STATE}${callId}`);
  if (callState) {
    const state = JSON.parse(callState);
    state.status = 'ringing';
    await redis.setex(`${RedisKeys.CALL_STATE}${callId}`, 300, JSON.stringify(state));
  }

  return call;
};

/**
 * Accept call
 */
export const acceptCall = async (
  callId: string,
  participantId: string
): Promise<ICall> => {
  const call = await Call.findOne({ callId });
  if (!call) {
    throw new NotFoundError('Call not found');
  }

  // Verify participant
  const participant = call.participants.find(
    (p: ICallParticipant) => p.userId.toString() === participantId
  );

  if (!participant) {
    throw new ForbiddenError('You are not a participant of this call');
  }

  if (!['pending', 'ringing'].includes(participant.status)) {
    throw new BadRequestError('Cannot accept call in current state');
  }

  // Update participant status
  await (Call as any).updateParticipantStatus(callId, toObjectId(participantId), 'joined');

  // Update call status
  const updatedCall = await (Call as any).updateCallStatus(callId, 'accepted');

  // Update Redis state
  const callState = await redis.get(`${RedisKeys.CALL_STATE}${callId}`);
  if (callState) {
    const state = JSON.parse(callState);
    state.status = 'accepted';
    state.startedAt = new Date().toISOString();
    await redis.setex(`${RedisKeys.CALL_STATE}${callId}`, 3600, JSON.stringify(state));
  }

  logCallEvent({
    action: 'accepted',
    callId,
    callerId: call.caller.toString(),
    receiverId: participantId,
    callType: call.callType,
  });

  await updatedCall.populate([
    { path: 'caller', select: 'displayName avatar username' },
    { path: 'participants.userId', select: 'displayName avatar username' },
  ]);

  return updatedCall;
};

/**
 * Reject call
 */
export const rejectCall = async (
  callId: string,
  participantId: string,
  reason = 'rejected'
): Promise<ICall> => {
  const call = await Call.findOne({ callId });
  if (!call) {
    throw new NotFoundError('Call not found');
  }

  // Verify participant
  const participant = call.participants.find(
    (p: ICallParticipant) => p.userId.toString() === participantId
  );

  if (!participant) {
    throw new ForbiddenError('You are not a participant of this call');
  }

  // Update participant status
  await (Call as any).updateParticipantStatus(callId, toObjectId(participantId), 'rejected');

  // If all participants rejected, end the call
  const updatedCall = await Call.findOne({ callId });
  const allRejected = updatedCall!.participants.every(
    (p: ICallParticipant) => p.status === 'rejected'
  );

  if (allRejected || !call.isGroupCall) {
    await (Call as any).updateCallStatus(callId, 'rejected', reason);
    await redis.del(`${RedisKeys.CALL_STATE}${callId}`);
  }

  logCallEvent({
    action: 'rejected',
    callId,
    callerId: call.caller.toString(),
    receiverId: participantId,
    callType: call.callType,
  });

  await updatedCall!.populate([
    { path: 'caller', select: 'displayName avatar username' },
    { path: 'participants.userId', select: 'displayName avatar username' },
  ]);

  return updatedCall!;
};

/**
 * End call
 */
export const endCall = async (
  callId: string,
  userId: string,
  reason = 'normal'
): Promise<ICall> => {
  const call = await Call.findOne({ callId });
  if (!call) {
    throw new NotFoundError('Call not found');
  }

  // Verify user is caller or participant
  const isCaller = call.caller.toString() === userId;
  const isParticipant = call.participants.some(
    (p: ICallParticipant) => p.userId.toString() === userId
  );

  if (!isCaller && !isParticipant) {
    throw new ForbiddenError('You are not part of this call');
  }

  // End call
  const endedCall = await (Call as any).endCall(callId, reason);

  // Clean up Redis
  await redis.del(`${RedisKeys.CALL_STATE}${callId}`);

  logCallEvent({
    action: 'ended',
    callId,
    callerId: call.caller.toString(),
    callType: call.callType,
    duration: endedCall.duration,
  });

  await endedCall.populate([
    { path: 'caller', select: 'displayName avatar username' },
    { path: 'participants.userId', select: 'displayName avatar username' },
  ]);

  return endedCall;
};

/**
 * Leave call (for group calls)
 */
export const leaveCall = async (
  callId: string,
  userId: string
): Promise<ICall> => {
  const call = await Call.findOne({ callId });
  if (!call) {
    throw new NotFoundError('Call not found');
  }

  if (!call.isGroupCall) {
    // For 1-1 calls, leaving ends the call
    return endCall(callId, userId, 'left');
  }

  // Update participant status
  await (Call as any).updateParticipantStatus(callId, toObjectId(userId), 'left');

  // Check if all participants have left
  const updatedCall = await Call.findOne({ callId });
  const activeParticipants = updatedCall!.participants.filter(
    (p: ICallParticipant) => p.status === 'joined'
  );

  // If no active participants and caller left, end call
  if (activeParticipants.length === 0 && call.caller.toString() !== userId) {
    return endCall(callId, userId, 'all_left');
  }

  await updatedCall!.populate([
    { path: 'caller', select: 'displayName avatar username' },
    { path: 'participants.userId', select: 'displayName avatar username' },
  ]);

  return updatedCall!;
};

/**
 * Handle call timeout (missed call)
 */
export const handleCallTimeout = async (callId: string): Promise<ICall | null> => {
  const call = await Call.findOne({ callId });
  if (!call) {
    return null;
  }

  // Only timeout if still ringing
  if (!['initiating', 'ringing'].includes(call.status)) {
    return null;
  }

  // Mark unanswered participants as missed
  for (const participant of call.participants) {
    if (['pending', 'ringing'].includes(participant.status)) {
      await (Call as any).updateParticipantStatus(
        callId,
        participant.userId,
        'missed'
      );
    }
  }

  // Update call status
  const missedCall = await (Call as any).updateCallStatus(callId, 'missed', 'timeout');

  // Clean up Redis
  await redis.del(`${RedisKeys.CALL_STATE}${callId}`);

  logCallEvent({
    action: 'missed',
    callId,
    callerId: call.caller.toString(),
    callType: call.callType,
  });

  return missedCall;
};

/**
 * Get call by ID
 */
export const getCallById = async (callId: string): Promise<ICall> => {
  const call = await Call.findOne({ callId })
    .populate('caller', 'displayName avatar username')
    .populate('participants.userId', 'displayName avatar username')
    .populate('groupId', 'name avatar');

  if (!call) {
    throw new NotFoundError('Call not found');
  }

  return call;
};

/**
 * Get active call for user
 */
export const getActiveCall = async (userId: string): Promise<ICall | null> => {
  return (Call as any).getActiveCall(toObjectId(userId));
};

/**
 * Get call history for user
 */
export const getCallHistory = async (
  userId: string,
  page = 1,
  limit = 20,
  callType?: CallType
): Promise<{ calls: ICall[]; meta: IPaginationMeta }> => {
  const query: Record<string, any> = {
    $or: [
      { caller: toObjectId(userId) },
      { 'participants.userId': toObjectId(userId) },
    ],
    status: { $in: ['ended', 'rejected', 'missed'] },
  };

  if (callType) {
    query.callType = callType;
  }

  const total = await Call.countDocuments(query);

  const calls = await (Call as any).getCallHistory(
    toObjectId(userId),
    page,
    limit,
    callType
  );

  return {
    calls,
    meta: generatePaginationMeta(total, page, limit),
  };
};

/**
 * Get missed calls count
 */
export const getMissedCallsCount = async (
  userId: string,
  since?: Date
): Promise<number> => {
  return (Call as any).getMissedCallsCount(toObjectId(userId), since);
};

/**
 * Get call state from Redis
 */
export const getCallState = async (callId: string): Promise<any | null> => {
  const state = await redis.get(`${RedisKeys.CALL_STATE}${callId}`);
  return state ? JSON.parse(state) : null;
};

export default {
  initiateCall,
  setCallRinging,
  acceptCall,
  rejectCall,
  endCall,
  leaveCall,
  handleCallTimeout,
  getCallById,
  getActiveCall,
  getCallHistory,
  getMissedCallsCount,
  getCallState,
};
