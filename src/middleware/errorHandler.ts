// ===========================================
// PROCONNECT - ERROR HANDLING MIDDLEWARE
// Centralized error handling
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError as CustomValidationError } from '../utils/errors';
import { logger, logError } from '../utils/logger';
import { appConfig } from '../config';

/**
 * Handle 404 Not Found errors
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

/**
 * Global error handler
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error
  logError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: (req as any).userId,
  });

  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let error: string | undefined;
  let errors: string[] | undefined;

  // Handle operational errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    
    // Handle custom ValidationError
    if (err instanceof CustomValidationError) {
      errors = err.errors;
    }
  }

  // Handle specific error types
  if (err.name === 'ValidationError' && !(err instanceof CustomValidationError)) {
    // Mongoose validation error
    statusCode = 422;
    message = 'Validation Error';
    error = err.message;
  }

  if (err.name === 'CastError') {
    // Mongoose cast error (invalid ObjectId)
    statusCode = 400;
    message = 'Invalid ID format';
  }

  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    message = 'Duplicate entry';
    
    // Extract field name from error
    const match = err.message.match(/index: (.+?)_/);
    if (match) {
      message = `${match[1]} already exists`;
    }
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Include stack trace in development
  if (appConfig.isDevelopment) {
    error = err.stack;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }), // Include validation errors if present
    error: appConfig.isDevelopment ? error : undefined,
    ...(appConfig.isDevelopment && { stack: err.stack }),
  });
};

/**
 * Handle async errors wrapper
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
export const setupUnhandledRejectionHandler = (): void => {
  process.on('unhandledRejection', (reason: Error) => {
    logger.fatal({ reason: reason.message, stack: reason.stack }, 'Unhandled Rejection');
    
    // In production, give time for logs to flush before exiting
    if (appConfig.isProduction) {
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });
};

/**
 * Handle uncaught exceptions
 */
export const setupUncaughtExceptionHandler = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught Exception');
    
    // Always exit on uncaught exception
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

export default {
  notFoundHandler,
  errorHandler,
  asyncHandler,
  setupUnhandledRejectionHandler,
  setupUncaughtExceptionHandler,
};
