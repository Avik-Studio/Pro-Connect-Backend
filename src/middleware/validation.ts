// ===========================================
// PROCONNECT - REQUEST VALIDATION MIDDLEWARE
// Zod-based input validation
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Validate request body against a Zod schema
 */
export const validateBody = <T extends ZodSchema>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(
          (e) => `${e.path.join('.')}: ${e.message}`
        );
        next(new ValidationError('Validation failed', errorMessages));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate request query parameters against a Zod schema
 */
export const validateQuery = <T extends ZodSchema>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(
          (e) => `${e.path.join('.')}: ${e.message}`
        );
        next(new ValidationError('Query validation failed', errorMessages));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate request params against a Zod schema
 */
export const validateParams = <T extends ZodSchema>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(
          (e) => `${e.path.join('.')}: ${e.message}`
        );
        next(new ValidationError('Params validation failed', errorMessages));
      } else {
        next(error);
      }
    }
  };
};

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores'
    ),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name cannot exceed 50 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

// User schemas
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name cannot exceed 50 characters')
    .optional(),
  bio: z.string().max(200, 'Bio cannot exceed 200 characters').optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
  phoneNumber: z.string().optional(),
});

export const updateSettingsSchema = z.object({
  notifications: z
    .object({
      messages: z.boolean().optional(),
      calls: z.boolean().optional(),
      groups: z.boolean().optional(),
    })
    .optional(),
  privacy: z
    .object({
      lastSeen: z.enum(['everyone', 'contacts', 'nobody']).optional(),
      profilePhoto: z.enum(['everyone', 'contacts', 'nobody']).optional(),
      status: z.enum(['everyone', 'contacts', 'nobody']).optional(),
    })
    .optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

// Message schemas
export const sendMessageSchema = z.object({
  content: z.string().max(5000, 'Message cannot exceed 5000 characters').optional(),
  messageType: z.enum(['text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'sticker']).default('text'),
  replyTo: z.string().optional(),
  media: z
    .object({
      url: z.string().url(),
      publicId: z.string(),
      fileName: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
      duration: z.number().optional(),
      thumbnail: z.string().optional(),
      dimensions: z
        .object({
          width: z.number(),
          height: z.number(),
        })
        .optional(),
    })
    .optional(),
});

// Group schemas
export const createGroupSchema = z.object({
  name: z
    .string()
    .min(2, 'Group name must be at least 2 characters')
    .max(100, 'Group name cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  members: z.array(z.string()).min(1, 'At least one member is required'),
  avatar: z.string().url('Invalid avatar URL').optional(),
});

export const updateGroupSchema = z.object({
  name: z
    .string()
    .min(2, 'Group name must be at least 2 characters')
    .max(100, 'Group name cannot exceed 100 characters')
    .optional(),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  avatar: z.string().url('Invalid avatar URL').optional().nullable(),
  settings: z
    .object({
      isPublic: z.boolean().optional(),
      allowMemberInvites: z.boolean().optional(),
      allowMemberMessages: z.boolean().optional(),
      maxMembers: z.number().min(2).max(1024).optional(),
      messageRetention: z.number().min(0).optional(),
    })
    .optional(),
});

export const addGroupMembersSchema = z.object({
  members: z.array(z.string()).min(1, 'At least one member is required'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

// Call schemas
export const initiateCallSchema = z.object({
  receiverId: z.string().optional(),
  groupId: z.string().optional(),
  callType: z.enum(['audio', 'video']),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ID parameter schema
export const objectIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

// FCM token schema
export const fcmTokenSchema = z.object({
  fcmToken: z.string().min(1, 'FCM token is required'),
});

export default {
  validateBody,
  validateQuery,
  validateParams,
};
