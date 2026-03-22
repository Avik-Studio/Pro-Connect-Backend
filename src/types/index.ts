// ===========================================
// PROCONNECT - TYPESCRIPT TYPE DEFINITIONS
// Global types and interfaces
// ===========================================

import { Request } from 'express';
import { Document, Types } from 'mongoose';

// ===========================================
// USER TYPES
// ===========================================

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password?: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  phoneNumber?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  authProvider: 'local' | 'google' | 'apple';
  googleId?: string;
  appleId?: string;
  fcmTokens: string[];
  lastSeen: Date;
  isOnline: boolean;
  status: 'active' | 'inactive' | 'banned';
  role: 'user' | 'admin';
  settings: IUserSettings;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUserSettings {
  notifications: {
    messages: boolean;
    calls: boolean;
    groups: boolean;
  };
  privacy: {
    lastSeen: 'everyone' | 'contacts' | 'nobody';
    profilePhoto: 'everyone' | 'contacts' | 'nobody';
    status: 'everyone' | 'contacts' | 'nobody';
  };
  theme: 'light' | 'dark' | 'system';
}

// ===========================================
// MESSAGE TYPES
// ===========================================

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'contact' | 'sticker';
export type MessageStatus = 'sent' | 'delivered' | 'seen';
export type ChatType = 'private' | 'group';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  chatId: Types.ObjectId;
  chatType: ChatType;
  sender: Types.ObjectId;
  content: string;
  messageType: MessageType;
  media?: IMediaAttachment;
  replyTo?: Types.ObjectId;
  status: MessageStatus;
  deliveredTo: IDeliveryReceipt[];
  seenBy: IDeliveryReceipt[];
  isEdited: boolean;
  isDeleted: boolean;
  deletedFor: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IMediaAttachment {
  url: string;
  publicId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number; // for audio/video
  thumbnail?: string;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface IDeliveryReceipt {
  userId: Types.ObjectId;
  timestamp: Date;
}

// ===========================================
// CONVERSATION TYPES
// ===========================================

export interface IConversation extends Document {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  lastMessage?: Types.ObjectId;
  lastMessageAt: Date;
  isGroup: boolean;
  groupId?: Types.ObjectId;
  unreadCount: Map<string, number>;
  isPinned: Map<string, boolean>;
  isMuted: Map<string, Date | null>;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// GROUP TYPES
// ===========================================

export type GroupRole = 'owner' | 'admin' | 'member';

export interface IGroup extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  avatar?: string;
  owner: Types.ObjectId;
  members: IGroupMember[];
  settings: IGroupSettings;
  inviteLink?: string;
  inviteLinkExpiry?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroupMember {
  userId: Types.ObjectId;
  role: GroupRole;
  joinedAt: Date;
  addedBy?: Types.ObjectId;
  nickname?: string;
  isMuted: boolean;
  mutedUntil?: Date;
}

export interface IGroupSettings {
  isPublic: boolean;
  allowMemberInvites: boolean;
  allowMemberMessages: boolean;
  maxMembers: number;
  messageRetention: number; // days, 0 = forever
}

// ===========================================
// CALL TYPES
// ===========================================

export type CallType = 'audio' | 'video';
export type CallStatus = 'initiating' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed' | 'busy' | 'failed';

export interface ICall extends Document {
  _id: Types.ObjectId;
  callId: string;
  caller: Types.ObjectId;
  callType: CallType;
  isGroupCall: boolean;
  groupId?: Types.ObjectId;
  participants: ICallParticipant[];
  status: CallStatus;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // seconds
  endReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICallParticipant {
  userId: Types.ObjectId;
  status: 'pending' | 'ringing' | 'joined' | 'left' | 'rejected' | 'missed';
  joinedAt?: Date;
  leftAt?: Date;
}

// ===========================================
// AUTH TYPES
// ===========================================

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  deviceInfo: IDeviceInfo;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface IDeviceInfo {
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web' | 'desktop';
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ITokenPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ===========================================
// REQUEST TYPES
// ===========================================

// Use Express.Request with module augmentation instead of extending Request
// This avoids TypeScript conflicts between middleware and route handlers
export type AuthenticatedRequest = Request & {
  user?: IUser;
  userId?: string;
  deviceInfo?: IDeviceInfo;
};

// ===========================================
// SOCKET TYPES
// ===========================================

export interface ISocketUser {
  odId: string;
  socketIds: string[];
  isOnline: boolean;
  lastSeen: Date;
}

export interface ITypingEvent {
  chatId: string;
  chatType: ChatType;
  userId: string;
  isTyping: boolean;
}

export interface IPresenceEvent {
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
}

// ===========================================
// NOTIFICATION TYPES
// ===========================================

export interface INotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

// ===========================================
// API RESPONSE TYPES
// ===========================================

export interface IApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: IPaginationMeta;
}

export interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface IPaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ===========================================
// WEBRTC TYPES
// ===========================================

// WebRTC types (defined here since DOM types not available in Node.js)
export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
}

export interface IWebRTCOffer {
  callId: string;
  sdp: RTCSessionDescriptionInit;
  from: string;
  to: string;
}

export interface IWebRTCAnswer {
  callId: string;
  sdp: RTCSessionDescriptionInit;
  from: string;
  to: string;
}

export interface IICECandidate {
  callId: string;
  candidate: RTCIceCandidateInit;
  from: string;
  to: string;
}

// ===========================================
// REDIS KEY TYPES
// ===========================================

export enum RedisKeys {
  USER_SESSION = 'session:',
  USER_ONLINE = 'online:',
  USER_SOCKETS = 'sockets:',
  TYPING = 'typing:',
  CALL_STATE = 'call:',
  RATE_LIMIT = 'ratelimit:',
  REFRESH_TOKEN = 'refresh:',
  OTP = 'otp:',
}

// ===========================================
// SOCKET.IO EVENT TYPES
// ===========================================

export interface ClientToServerEvents {
  // Conversation events
  'join-conversation': (conversationId: string) => void;
  'leave-conversation': (conversationId: string) => void;
  
  // Message events
  'send-message': (
    data: {
      conversationId: string;
      content?: string;
      messageType: MessageType;
      media?: IMediaAttachment[];
      replyTo?: string;
      tempId?: string;
    },
    callback?: (response: { success: boolean; message?: any; tempId?: string; error?: string }) => void
  ) => void;
  
  // Typing events
  'typing-start': (conversationId: string) => void;
  'typing-stop': (conversationId: string) => void;
  
  // Message status events
  'message-delivered': (data: { messageId: string; conversationId: string }) => void;
  'message-read': (data: { messageId: string; conversationId: string }) => void;
  
  // Call events
  'call-initiate': (
    data: { receiverId?: string; callType: CallType; groupId?: string },
    callback?: (response: { success: boolean; call?: any; error?: string }) => void
  ) => void;
  'call-offer': (data: { callId: string; targetUserId: string; offer: RTCSessionDescriptionInit }) => void;
  'call-answer': (data: { callId: string; targetUserId: string; answer: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (data: { callId: string; targetUserId: string; candidate: RTCIceCandidateInit }) => void;
  'call-accept': (
    data: { callId: string },
    callback?: (response: { success: boolean; call?: any; error?: string }) => void
  ) => void;
  'call-reject': (
    data: { callId: string; reason?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'call-end': (
    data: { callId: string; reason?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'toggle-media': (data: { callId: string; mediaType: 'audio' | 'video'; enabled: boolean }) => void;
  
  // Group events
  'join-group': (groupId: string) => void;
  'leave-group': (groupId: string) => void;
  
  // Presence events
  'presence-subscribe': (userIds: string[]) => void;
  'presence-unsubscribe': (userIds: string[]) => void;
}

export interface ServerToClientEvents {
  // Message events
  'new-message': (message: any) => void;
  'message-status-update': (data: { messageId: string; status: MessageStatus; userId: string }) => void;
  
  // Typing events
  'user-typing': (data: { conversationId: string; userId: string; username: string }) => void;
  'user-stopped-typing': (data: { conversationId: string; userId: string }) => void;

  // Call events
  'incoming-call': (data: { call: any; caller: { id: string; username: string } }) => void;
  'call-offer': (data: { callId: string; fromUserId: string; offer: RTCSessionDescriptionInit }) => void;
  'call-answer': (data: { callId: string; fromUserId: string; answer: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (data: { callId: string; fromUserId: string; candidate: RTCIceCandidateInit }) => void;
  'call-accepted': (data: { callId: string; acceptedBy: string }) => void;
  'call-rejected': (data: { callId: string; rejectedBy: string; reason?: string }) => void;
  'call-ended': (data: { callId: string; endedBy: string; reason?: string; duration?: number }) => void;
  'media-toggled': (data: { userId: string; mediaType: 'audio' | 'video'; enabled: boolean }) => void;

  // WebRTC signaling events (alternative names used by frontend)
  'webrtc-offer': (data: { callId: string; offer: RTCSessionDescriptionInit }) => void;
  'webrtc-answer': (data: { callId: string; answer: RTCSessionDescriptionInit }) => void;
  'webrtc-ice-candidate': (data: { callId: string; candidate: RTCIceCandidateInit }) => void;
  
  // Presence events
  'presence-update': (data: Record<string, { isOnline: boolean; lastSeen?: string | null }>) => void;
  
  // Group events
  'group-updated': (data: { groupId: string; updates: any }) => void;
  'member-joined': (data: { groupId: string; member: any }) => void;
  'member-left': (data: { groupId: string; memberId: string }) => void;
}

export interface SocketData {
  userId: string;
  username: string;
}
