// ===========================================
// PROCONNECT - API RESPONSE UTILITY
// Standardized API responses
// ===========================================

import { Response } from 'express';
import { IApiResponse, IPaginationMeta } from '../types';

/**
 * Send success response
 */
export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  meta?: IPaginationMeta,
  statusCode = 200
): Response => {
  const response: IApiResponse<T> = {
    success: true,
    message,
    data,
    meta,
  };
  return res.status(statusCode).json(response);
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  error?: string
): Response => {
  const response: IApiResponse = {
    success: false,
    message,
    error,
  };
  return res.status(statusCode).json(response);
};

/**
 * Send created response (201)
 */
export const sendCreated = <T>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data, undefined, 201);
};

/**
 * Send no content response (204)
 */
export const sendNoContent = (res: Response): Response => {
  return res.status(204).send();
};

/**
 * Send unauthorized response (401)
 */
export const sendUnauthorized = (
  res: Response,
  message = 'Unauthorized access'
): Response => {
  return sendError(res, message, 401);
};

/**
 * Send forbidden response (403)
 */
export const sendForbidden = (
  res: Response,
  message = 'Access forbidden'
): Response => {
  return sendError(res, message, 403);
};

/**
 * Send not found response (404)
 */
export const sendNotFound = (
  res: Response,
  message = 'Resource not found'
): Response => {
  return sendError(res, message, 404);
};

/**
 * Send conflict response (409)
 */
export const sendConflict = (
  res: Response,
  message = 'Resource already exists'
): Response => {
  return sendError(res, message, 409);
};

/**
 * Send validation error response (422)
 */
export const sendValidationError = (
  res: Response,
  message = 'Validation failed',
  errors?: string
): Response => {
  return sendError(res, message, 422, errors);
};

/**
 * Send too many requests response (429)
 */
export const sendTooManyRequests = (
  res: Response,
  message = 'Too many requests, please try again later'
): Response => {
  return sendError(res, message, 429);
};

/**
 * Send internal server error response (500)
 */
export const sendServerError = (
  res: Response,
  message = 'Internal server error'
): Response => {
  return sendError(res, message, 500);
};

export default {
  sendSuccess,
  sendError,
  sendCreated,
  sendNoContent,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError,
  sendTooManyRequests,
  sendServerError,
};
