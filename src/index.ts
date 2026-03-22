// ===========================================
// PROCONNECT - MAIN APPLICATION ENTRY POINT
// Production-ready Express + Socket.IO server
// ===========================================

// Import type augmentation first (side-effect import)
import './types/express-types';

import http from 'http';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import appConfig from './config';
import { connectDatabase } from './config/database';
import { swaggerSpec } from './config/swagger';
import { redis, redisPub, redisSub } from './config/redis';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initializeSocketIO } from './socket';
import { sendNotification } from './services/notificationService';
import logger from './utils/logger';

// ===========================================
// APPLICATION SETUP
// ===========================================

const app: Express = express();
const server = http.createServer(app);

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================

// Helmet security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      ...appConfig.cors.origin,
      appConfig.frontend.url,
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (appConfig.nodeEnv === 'development') {
      callback(null, true); // Allow all in development
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: appConfig.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ===========================================
// GENERAL MIDDLEWARE
// ===========================================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing
app.use(cookieParser());

// Compression
app.use(compression());

// Request logging
if (appConfig.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// ===========================================
// HEALTH CHECK ROUTES
// ===========================================

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: appConfig.nodeEnv,
  });
});

// ===========================================
// SWAGGER API DOCUMENTATION
// ===========================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ProConnect API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
}));

// Serve Swagger JSON spec
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

logger.info(`Swagger API Documentation available at: http://localhost:${appConfig.port}/api-docs`);

app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const mongoose = await import('mongoose');
    const dbStatus = mongoose.connection.readyState === 1;
    
    // Check Redis connection
    const redisStatus = redis.status === 'ready';

    if (dbStatus && redisStatus) {
      res.status(200).json({
        status: 'ready',
        database: 'connected',
        redis: 'connected',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        database: dbStatus ? 'connected' : 'disconnected',
        redis: redisStatus ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ===========================================
// API ROUTES
// ===========================================

app.use('/api/v1', routes);

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database connection
      const mongoose = await import('mongoose');
      await mongoose.default.connection.close();
      logger.info('Database connection closed');

      // Close Redis connection
      await Promise.all([
        redis.quit(),
        redisPub.quit(),
        redisSub.quit(),
      ]);
      logger.info('Redis connections closed');

      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ===========================================
// UNHANDLED ERRORS
// ===========================================

process.on('uncaughtException', (error: Error) => {
  logger.error({ err: error }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error({ err: reason }, 'Unhandled Rejection');
  process.exit(1);
});

// ===========================================
// SERVER STARTUP
// ===========================================

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    logger.info('Connected to MongoDB');

    // Redis is already connected on import
    logger.info('Connected to Redis');

    // Firebase is automatically initialized in notificationService
    logger.info('Firebase Cloud Messaging ready');

    // Initialize Socket.IO
    initializeSocketIO(server);
    logger.info('Socket.IO initialized');

    // Start HTTP server
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${appConfig.port} is already in use`);
      } else {
        logger.error({ err: error }, 'Server error');
      }
      process.exit(1);
    });

    server.listen(appConfig.port, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 ProConnect Backend Server                             ║
║                                                            ║
║   Environment: ${appConfig.nodeEnv.padEnd(42)}║
║   Port: ${String(appConfig.port).padEnd(49)}║
║   API: http://localhost:${appConfig.port}/api/v1${' '.repeat(28)}║
║   Docs: http://localhost:${appConfig.port}/api-docs${' '.repeat(26)}║
║   Health: http://localhost:${appConfig.port}/health${' '.repeat(25)}║
║                                                            ║
║   Socket.IO: Enabled                                       ║
║   WebRTC Signaling: Enabled                                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export { app, server };
