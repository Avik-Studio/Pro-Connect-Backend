// ===========================================
// PROCONNECT - HELPER UTILITIES
// Common utility functions
// ===========================================

import { Types } from 'mongoose';
import { IPaginationMeta, IPaginationQuery } from '../types';

/**
 * Check if string is a valid MongoDB ObjectId
 */
export const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id;
};

/**
 * Convert string to ObjectId
 */
export const toObjectId = (id: string): Types.ObjectId => {
  return new Types.ObjectId(id);
};

/**
 * Generate pagination metadata
 */
export const generatePaginationMeta = (
  total: number,
  page: number,
  limit: number
): IPaginationMeta => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/**
 * Parse pagination query parameters
 */
export const parsePaginationQuery = (query: IPaginationQuery): {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
} => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {
    [query.sortBy || 'createdAt']: query.sortOrder === 'asc' ? 1 : -1,
  };
  return { page, limit, skip, sort };
};

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Generate random string
 */
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate unique invite code
 */
export const generateInviteCode = (): string => {
  return generateRandomString(8).toUpperCase();
};

/**
 * Sanitize user object for response (remove sensitive fields)
 */
export const sanitizeUser = <T extends Record<string, any>>(user: T): Partial<T> => {
  const sanitized = { ...user };
  delete sanitized.password;
  delete sanitized.__v;
  return sanitized;
};

/**
 * Extract file extension from filename
 */
export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

/**
 * Get MIME type category
 */
export const getMimeCategory = (mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'other' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/pdf') || 
      mimeType.startsWith('application/msword') ||
      mimeType.startsWith('application/vnd.')) return 'document';
  return 'other';
};

/**
 * Format file size to human readable
 */
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Calculate call duration in seconds
 */
export const calculateDuration = (startTime: Date, endTime: Date): number => {
  return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
};

/**
 * Format duration to HH:MM:SS
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Mask email for privacy
 */
export const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}${localPart[1]}***@${domain}`;
};

/**
 * Mask phone number for privacy
 */
export const maskPhoneNumber = (phone: string): string => {
  if (phone.length <= 4) return '****';
  return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Remove undefined values from object
 */
export const removeUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

/**
 * Parse time string to milliseconds (e.g., '15m', '7d', '1h')
 */
export const parseTimeString = (timeStr: string): number => {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  
  const match = timeStr.match(/^(\d+)([smhdw])$/);
  if (!match) {
    throw new Error(`Invalid time string: ${timeStr}`);
  }
  
  const [, value, unit] = match;
  return parseInt(value, 10) * units[unit];
};

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};
