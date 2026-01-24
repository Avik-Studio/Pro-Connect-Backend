// ===========================================
// PROCONNECT - USER MODEL
// MongoDB schema for user management
// ===========================================

import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { IUser, IUserSettings } from '../types';

// Default user settings
const defaultSettings: IUserSettings = {
  notifications: {
    messages: true,
    calls: true,
    groups: true,
  },
  privacy: {
    lastSeen: 'everyone',
    profilePhoto: 'everyone',
    status: 'everyone',
  },
  theme: 'system',
};

// User settings sub-schema
const userSettingsSchema = new Schema<IUserSettings>(
  {
    notifications: {
      messages: { type: Boolean, default: true },
      calls: { type: Boolean, default: true },
      groups: { type: Boolean, default: true },
    },
    privacy: {
      lastSeen: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone',
      },
      profilePhoto: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone',
      },
      status: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone',
      },
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
  },
  { _id: false }
);

// Main user schema
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      index: true,
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password in queries by default
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
      index: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      minlength: [2, 'Display name must be at least 2 characters'],
      maxlength: [50, 'Display name cannot exceed 50 characters'],
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [200, 'Bio cannot exceed 200 characters'],
      default: '',
    },
    phoneNumber: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'apple'],
      default: 'local',
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
    appleId: {
      type: String,
      sparse: true,
      index: true,
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    settings: {
      type: userSettingsSchema,
      default: () => defaultSettings,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: Record<string, unknown>) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// ===========================================
// INDEXES
// ===========================================

// Compound indexes for efficient queries
userSchema.index({ email: 1, status: 1 });
userSchema.index({ username: 1, status: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isOnline: 1, lastSeen: -1 });

// Text index for search
userSchema.index({ displayName: 'text', username: 'text', email: 'text' });

// ===========================================
// MIDDLEWARE
// ===========================================

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// ===========================================
// INSTANCE METHODS
// ===========================================

/**
 * Compare password with hashed password
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// ===========================================
// STATIC METHODS
// ===========================================

/**
 * Find user by email
 */
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

/**
 * Find user by username
 */
userSchema.statics.findByUsername = function (username: string) {
  return this.findOne({ username: username.toLowerCase() });
};

/**
 * Find active users
 */
userSchema.statics.findActiveUsers = function () {
  return this.find({ status: 'active' });
};

/**
 * Search users by query
 */
userSchema.statics.searchUsers = function (query: string, limit = 20) {
  return this.find(
    { $text: { $search: query }, status: 'active' },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
};

// Create and export the model
const User = mongoose.model<IUser>('User', userSchema);

export default User;
