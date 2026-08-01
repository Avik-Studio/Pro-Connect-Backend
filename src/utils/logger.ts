// ===========================================
// PROCONNECT - LOGGER UTILITY
// Vercel-compatible Pino Logger
// ===========================================

import pino from 'pino';
import { appConfig } from '../config';

// ===========================================
// BASE LOGGER CONFIGURATION
// ===========================================

const baseConfig: pino.LoggerOptions = {
  level: appConfig.logging.level,

  timestamp: pino.stdTimeFunctions.isoTime,

  formatters: {
    level: (label) => ({
      level: label,
    }),

    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      node_version: process.version,
    }),
  },

  base: {
    env: appConfig.nodeEnv,
    service: 'proconnect-api',
  },
};

// ===========================================
// CREATE LOGGER
// ===========================================

let loggerInstance: pino.Logger;

if (appConfig.isDevelopment) {
  // Local development
  // Pretty formatted console logs
  loggerInstance = pino(
    baseConfig,
    pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    })
  );
} else {
  // Production / Vercel
  // Log directly to stdout.
  // Vercel automatically captures these logs.
  loggerInstance = pino(baseConfig);
}

export const logger = loggerInstance;

// ===========================================
// SPECIALIZED LOGGERS
// ===========================================

/**
 * HTTP Request Logger
 */
export const httpLogger = logger.child({
  module: 'http',
});

/**
 * Socket.IO Logger
 */
export const socketLogger = logger.child({
  module: 'socket',
});

/**
 * Database Logger
 */
export const dbLogger = logger.child({
  module: 'database',
});

/**
 * Auth Logger
 */
export const authLogger = logger.child({
  module: 'auth',
});

/**
 * Call Logger
 */
export const callLogger = logger.child({
  module: 'call',
});

// ===========================================
// LOGGER UTILITIES
// ===========================================

/**
 * Log HTTP request details
 */
export const logHttpRequest = (req: {
  method: string;
  url: string;
  ip?: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
}): void => {
  httpLogger.info(
    {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.userId,
      duration: req.duration
        ? `${req.duration}ms`
        : undefined,
      statusCode: req.statusCode,
    },
    'HTTP Request'
  );
};

/**
 * Log Socket event details
 */
export const logSocketEvent = (event: {
  eventName: string;
  userId?: string;
  socketId: string;
  data?: unknown;
  direction: 'incoming' | 'outgoing';
}): void => {
  socketLogger.debug(
    {
      event: event.eventName,
      userId: event.userId,
      socketId: event.socketId,
      direction: event.direction,
    },
    `Socket ${event.direction} event`
  );
};

/**
 * Log authentication events
 */
export const logAuthEvent = (event: {
  action:
    | 'login'
    | 'logout'
    | 'register'
    | 'token_refresh'
    | 'oauth'
    | 'password_reset';
  userId?: string;
  email?: string;
  success: boolean;
  ip?: string;
  reason?: string;
}): void => {
  const logFn = event.success
    ? authLogger.info.bind(authLogger)
    : authLogger.warn.bind(authLogger);

  logFn(
    {
      action: event.action,
      userId: event.userId,
      email: event.email,
      success: event.success,
      ip: event.ip,
      reason: event.reason,
    },
    `Auth ${event.action}`
  );
};

/**
 * Log call events
 */
export const logCallEvent = (event: {
  action:
    | 'initiated'
    | 'accepted'
    | 'rejected'
    | 'ended'
    | 'missed'
    | 'failed';
  callId: string;
  callerId: string;
  receiverId?: string;
  groupId?: string;
  callType: 'audio' | 'video';
  duration?: number;
}): void => {
  callLogger.info(
    {
      action: event.action,
      callId: event.callId,
      callerId: event.callerId,
      receiverId: event.receiverId,
      groupId: event.groupId,
      callType: event.callType,
      duration: event.duration,
    },
    `Call ${event.action}`
  );
};

/**
 * Log error with stack trace
 */
export const logError = (
  error: Error,
  context?: Record<string, unknown>
): void => {
  logger.error(
    {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    },
    'Error occurred'
  );
};

export default logger;
