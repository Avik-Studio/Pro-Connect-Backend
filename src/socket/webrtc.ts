// ===========================================
// PROCONNECT - WEBRTC SIGNALING
// WebRTC signaling server utilities
// ===========================================

import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { appConfig } from '../config';
import crypto from 'crypto';

// ===========================================
// TURN/STUN SERVER CONFIGURATION
// ===========================================

export interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Get ICE servers configuration for WebRTC
 * Includes STUN and TURN servers
 */
export const getICEServers = async (userId: string): Promise<ICEServer[]> => {
  const iceServers: ICEServer[] = [];

  // Add Google STUN servers (free)
  iceServers.push({
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
    ],
  });

  // Add custom TURN server if configured
  if (appConfig.turn.url) {
    // Generate time-limited credentials for TURN
    const credentials = await generateTURNCredentials(userId);
    
    iceServers.push({
      urls: [
        `turn:${appConfig.turn.url}:${appConfig.turn.port}`,
        `turn:${appConfig.turn.url}:${appConfig.turn.port}?transport=tcp`,
      ],
      username: credentials.username,
      credential: credentials.password,
    });

    // Add TURNS (TLS) if available
    if (appConfig.turn.tlsPort) {
      iceServers.push({
        urls: `turns:${appConfig.turn.url}:${appConfig.turn.tlsPort}`,
        username: credentials.username,
        credential: credentials.password,
      });
    }
  }

  return iceServers;
};

/**
 * Generate time-limited TURN credentials
 * Using the long-term credential mechanism (RFC 5389)
 */
export const generateTURNCredentials = async (
  userId: string
): Promise<{ username: string; password: string }> => {
  const crypto = await import('crypto');
  
  // Credential valid for 24 hours
  const ttl = 24 * 60 * 60;
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  
  // Username format: timestamp:uniqueId
  const username = `${timestamp}:${userId}`;
  
  // Generate password using HMAC-SHA1
  const hmac = crypto.createHmac('sha1', appConfig.turn.secret);
  hmac.update(username);
  const password = hmac.digest('base64');

  return { username, password };
};

// ===========================================
// WEBRTC TYPE DEFINITIONS
// ===========================================

// WebRTC type definitions for server-side use
export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface MediaTrackConstraints {
  [key: string]: any;
}

// ===========================================
// CALL STATE MANAGEMENT
// ===========================================

export interface CallState {
  callId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'connecting' | 'connected' | 'ended';
  caller: string;
  participants: string[];
  startTime?: Date;
  offers: Map<string, RTCSessionDescriptionInit>;
  answers: Map<string, RTCSessionDescriptionInit>;
  iceCandidates: Map<string, RTCIceCandidateInit[]>;
}

const CALL_STATE_TTL = 300; // 5 minutes

/**
 * Save call state to Redis
 */
export const saveCallState = async (state: CallState): Promise<void> => {
  const key = `call:state:${state.callId}`;
  await redis.setex(
    key,
    CALL_STATE_TTL,
    JSON.stringify({
      ...state,
      offers: Object.fromEntries(state.offers),
      answers: Object.fromEntries(state.answers),
      iceCandidates: Object.fromEntries(state.iceCandidates),
    })
  );
};

/**
 * Get call state from Redis
 */
export const getCallState = async (callId: string): Promise<CallState | null> => {
  const key = `call:state:${callId}`;
  const data = await redis.get(key);
  
  if (!data) return null;
  
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    offers: new Map(Object.entries(parsed.offers || {})),
    answers: new Map(Object.entries(parsed.answers || {})),
    iceCandidates: new Map(Object.entries(parsed.iceCandidates || {})),
  };
};

/**
 * Update call state in Redis
 */
export const updateCallState = async (
  callId: string,
  updates: Partial<CallState>
): Promise<void> => {
  const state = await getCallState(callId);
  if (state) {
    await saveCallState({ ...state, ...updates });
  }
};

/**
 * Delete call state from Redis
 */
export const deleteCallState = async (callId: string): Promise<void> => {
  const key = `call:state:${callId}`;
  await redis.del(key);
};

// ===========================================
// SDP MANIPULATION UTILITIES
// ===========================================

/**
 * Modify SDP to prefer specific codecs
 * Useful for ensuring consistent quality across devices
 */
export const modifySDP = (
  sdp: string,
  options: {
    preferredVideoCodec?: 'VP8' | 'VP9' | 'H264';
    preferredAudioCodec?: 'opus' | 'PCMU' | 'PCMA';
    maxBitrate?: number;
  }
): string => {
  let modifiedSDP = sdp;

  // Prefer specific video codec
  if (options.preferredVideoCodec) {
    modifiedSDP = preferCodec(modifiedSDP, 'video', options.preferredVideoCodec);
  }

  // Prefer specific audio codec
  if (options.preferredAudioCodec) {
    modifiedSDP = preferCodec(modifiedSDP, 'audio', options.preferredAudioCodec);
  }

  // Set max bitrate
  if (options.maxBitrate) {
    modifiedSDP = setMaxBitrate(modifiedSDP, options.maxBitrate);
  }

  return modifiedSDP;
};

/**
 * Prefer a specific codec in SDP
 */
const preferCodec = (sdp: string, mediaType: 'video' | 'audio', codec: string): string => {
  const lines = sdp.split('\r\n');
  let mLineIndex = -1;
  let payloadTypes: string[] = [];

  // Find the m= line for the media type
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`m=${mediaType}`)) {
      mLineIndex = i;
      const parts = lines[i].split(' ');
      payloadTypes = parts.slice(3);
      break;
    }
  }

  if (mLineIndex === -1) return sdp;

  // Find the payload type for the preferred codec
  let preferredPayloadType: string | null = null;
  for (let i = mLineIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith('m=')) break;
    
    const match = lines[i].match(new RegExp(`a=rtpmap:(\\d+) ${codec}/`, 'i'));
    if (match) {
      preferredPayloadType = match[1];
      break;
    }
  }

  if (!preferredPayloadType) return sdp;

  // Move preferred codec to front
  const newPayloadTypes = [
    preferredPayloadType,
    ...payloadTypes.filter(pt => pt !== preferredPayloadType),
  ];

  // Update m= line
  const mLineParts = lines[mLineIndex].split(' ');
  lines[mLineIndex] = [...mLineParts.slice(0, 3), ...newPayloadTypes].join(' ');

  return lines.join('\r\n');
};

/**
 * Set maximum bitrate in SDP
 */
const setMaxBitrate = (sdp: string, maxBitrate: number): string => {
  const lines = sdp.split('\r\n');
  const newLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    newLines.push(lines[i]);

    // Add b=AS line after c= line for video
    if (lines[i].startsWith('c=IN') && i + 1 < lines.length && !lines[i + 1].startsWith('b=')) {
      // Check if this is within a video section
      let inVideo = false;
      for (let j = i - 1; j >= 0; j--) {
        if (lines[j].startsWith('m=video')) {
          inVideo = true;
          break;
        }
        if (lines[j].startsWith('m=')) break;
      }
      
      if (inVideo) {
        newLines.push(`b=AS:${maxBitrate}`);
      }
    }
  }

  return newLines.join('\r\n');
};

// ===========================================
// BANDWIDTH ESTIMATION
// ===========================================

export interface BandwidthEstimate {
  availableBitrate: number;
  recommendedQuality: 'low' | 'medium' | 'high' | 'hd';
}

/**
 * Get recommended video quality based on bandwidth
 */
export const getRecommendedQuality = (bitrate: number): BandwidthEstimate['recommendedQuality'] => {
  if (bitrate >= 2500000) return 'hd';      // 2.5 Mbps - HD quality (720p+)
  if (bitrate >= 1000000) return 'high';    // 1 Mbps - High quality (480p)
  if (bitrate >= 500000) return 'medium';   // 500 Kbps - Medium quality (360p)
  return 'low';                               // Below 500 Kbps - Low quality (240p)
};

/**
 * Get video constraints based on quality
 */
export const getVideoConstraints = (
  quality: BandwidthEstimate['recommendedQuality']
): MediaTrackConstraints => {
  const constraints: Record<string, MediaTrackConstraints> = {
    hd: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    high: {
      width: { ideal: 854, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    medium: {
      width: { ideal: 640, max: 854 },
      height: { ideal: 360, max: 480 },
      frameRate: { ideal: 24, max: 30 },
    },
    low: {
      width: { ideal: 426, max: 640 },
      height: { ideal: 240, max: 360 },
      frameRate: { ideal: 15, max: 24 },
    },
  };

  return constraints[quality];
};

export default {
  getICEServers,
  generateTURNCredentials,
  saveCallState,
  getCallState,
  updateCallState,
  deleteCallState,
  modifySDP,
  getRecommendedQuality,
  getVideoConstraints,
};
