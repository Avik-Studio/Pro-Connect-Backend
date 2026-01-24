// ===========================================
// PROCONNECT - REFRESH TOKEN MODEL
// MongoDB schema for refresh token management
// ===========================================

import mongoose, { Schema, Model, Types } from 'mongoose';
import { IRefreshToken, IDeviceInfo } from '../types';
import crypto from 'crypto';

// Interface for static methods
interface IRefreshTokenModel extends Model<IRefreshToken> {
  generateToken(): string;
  createToken(
    userId: Types.ObjectId,
    deviceInfo: IDeviceInfo,
    expiryDays?: number
  ): Promise<IRefreshToken>;
  verifyToken(token: string): Promise<IRefreshToken | null>;
  revokeToken(token: string): Promise<IRefreshToken | null>;
  revokeAllUserTokens(userId: Types.ObjectId): Promise<void>;
  getUserActiveSessions(userId: Types.ObjectId): Promise<IRefreshToken[]>;
  revokeSession(userId: Types.ObjectId, sessionId: Types.ObjectId): Promise<IRefreshToken | null>;
  cleanupExpired(): Promise<{ deletedCount?: number }>;
  rotateToken(oldToken: string, expiryDays?: number): Promise<IRefreshToken | null>;
}

// Device info sub-schema
const deviceInfoSchema = new Schema<IDeviceInfo>(
  {
    deviceId: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ['ios', 'android', 'web', 'desktop'],
      required: true,
    },
    deviceName: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { _id: false }
);

// Main refresh token schema
const refreshTokenSchema = new Schema<IRefreshToken, IRefreshTokenModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceInfo: {
      type: deviceInfoSchema,
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        delete ret.token;
        return ret;
      },
    },
  }
);

// ===========================================
// INDEXES
// ===========================================

// TTL index to auto-delete expired tokens
refreshTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Compound index for user sessions lookup
refreshTokenSchema.index({ userId: 1, isRevoked: 1, expiresAt: 1 });

// ===========================================
// STATIC METHODS
// ===========================================

/**
 * Generate a secure token
 */
refreshTokenSchema.statics.generateToken = function (): string {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Create a new refresh token
 */
refreshTokenSchema.statics.createToken = async function (
  userId: mongoose.Types.ObjectId,
  deviceInfo: IDeviceInfo,
  expiryDays = 7
) {
  // Generate token
  const token = crypto.randomBytes(64).toString('hex');
  
  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  // Check if token exists for this device and revoke it
  await this.updateMany(
    {
      userId,
      'deviceInfo.deviceId': deviceInfo.deviceId,
      isRevoked: false,
    },
    { isRevoked: true }
  );

  // Create new token
  return this.create({
    userId,
    token,
    deviceInfo,
    expiresAt,
  });
};

/**
 * Verify and get refresh token
 */
refreshTokenSchema.statics.verifyToken = function (token: string) {
  return this.findOne({
    token,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).populate('userId');
};

/**
 * Revoke a token
 */
refreshTokenSchema.statics.revokeToken = function (token: string) {
  return this.findOneAndUpdate(
    { token },
    { isRevoked: true },
    { new: true }
  );
};

/**
 * Revoke all tokens for a user
 */
refreshTokenSchema.statics.revokeAllUserTokens = function (
  userId: mongoose.Types.ObjectId
) {
  return this.updateMany(
    { userId, isRevoked: false },
    { isRevoked: true }
  );
};

/**
 * Revoke all tokens except current
 */
refreshTokenSchema.statics.revokeOtherTokens = function (
  userId: mongoose.Types.ObjectId,
  currentToken: string
) {
  return this.updateMany(
    { userId, token: { $ne: currentToken }, isRevoked: false },
    { isRevoked: true }
  );
};

/**
 * Get active sessions for a user
 */
refreshTokenSchema.statics.getActiveSessions = function (
  userId: mongoose.Types.ObjectId
) {
  return this.find({
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).select('-token');
};

/**
 * Delete a session
 */
refreshTokenSchema.statics.deleteSession = function (
  userId: mongoose.Types.ObjectId,
  sessionId: mongoose.Types.ObjectId
) {
  return this.findOneAndDelete({
    _id: sessionId,
    userId,
  });
};

/**
 * Clean up expired tokens
 */
refreshTokenSchema.statics.cleanupExpired = function () {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isRevoked: true },
    ],
  });
};

/**
 * Rotate token (create new, revoke old)
 */
refreshTokenSchema.statics.rotateToken = async function (
  oldToken: string,
  expiryDays = 7
) {
  const existingToken = await this.findOne({ token: oldToken });
  if (!existingToken) return null;

  // Revoke old token
  existingToken.isRevoked = true;
  await existingToken.save();

  // Create new token
  return this.createToken(
    existingToken.userId,
    existingToken.deviceInfo,
    expiryDays
  );
};

// Create and export the model
const RefreshToken = mongoose.model<IRefreshToken, IRefreshTokenModel>('RefreshToken', refreshTokenSchema);

export default RefreshToken;
