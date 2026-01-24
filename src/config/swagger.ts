// ===========================================
// PROCONNECT - SWAGGER CONFIGURATION
// API Documentation with Swagger/OpenAPI
// ===========================================

import swaggerJsdoc from 'swagger-jsdoc';
import { appConfig } from './index';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ProConnect API',
    version: '1.0.0',
    description: `
# ProConnect Backend API

A production-ready, scalable backend for real-time messaging and audio/video calling applications.

## Features
- 🔐 JWT Authentication with refresh tokens
- 💬 Real-time messaging with Socket.IO
- 📞 WebRTC audio/video calling
- 👥 Group management
- 📱 Push notifications (FCM)
- 📁 Media uploads (Cloudinary/S3)

## Authentication
Most endpoints require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

## Rate Limiting
- Auth endpoints: 5 requests per 15 minutes
- Message endpoints: 60 requests per minute
- Upload endpoints: 10 requests per minute
- Search endpoints: 30 requests per minute
    `,
    contact: {
      name: 'ProConnect Support',
      email: 'support@proconnect.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: `http://localhost:${appConfig.port}/api/v1`,
      description: 'Development server',
    },
    {
      url: 'https://api.proconnect.com/api/v1',
      description: 'Production server',
    },
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication and session management' },
    { name: 'Users', description: 'User profile and settings management' },
    { name: 'Chat', description: 'Messaging and conversations' },
    { name: 'Groups', description: 'Group chat management' },
    { name: 'Calls', description: 'Audio/Video calling' },
    { name: 'Media', description: 'File upload and management' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
    },
    schemas: {
      // User Schema
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          username: { type: 'string', example: 'john_doe' },
          displayName: { type: 'string', example: 'John Doe' },
          avatar: { type: 'string', format: 'uri', example: 'https://example.com/avatar.jpg' },
          bio: { type: 'string', example: 'Hello, I am using ProConnect!' },
          isOnline: { type: 'boolean', example: true },
          lastSeen: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Auth Tokens
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
      },
      // Message Schema
      Message: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          sender: { $ref: '#/components/schemas/User' },
          content: { type: 'string', example: 'Hello!' },
          messageType: { 
            type: 'string', 
            enum: ['text', 'image', 'video', 'audio', 'file', 'location'],
            example: 'text'
          },
          status: { type: 'string', enum: ['sent', 'delivered', 'seen'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Conversation Schema
      Conversation: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          participants: { type: 'array', items: { $ref: '#/components/schemas/User' } },
          lastMessage: { $ref: '#/components/schemas/Message' },
          unreadCount: { type: 'integer', example: 5 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Group Schema
      Group: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Project Team' },
          description: { type: 'string', example: 'Team discussion group' },
          avatar: { type: 'string', format: 'uri' },
          owner: { $ref: '#/components/schemas/User' },
          members: { 
            type: 'array', 
            items: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/User' },
                role: { type: 'string', enum: ['owner', 'admin', 'member'] },
              }
            }
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Call Schema
      Call: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          caller: { $ref: '#/components/schemas/User' },
          callType: { type: 'string', enum: ['audio', 'video'] },
          status: { type: 'string', enum: ['ringing', 'accepted', 'ended', 'missed'] },
          duration: { type: 'integer', example: 120 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Error Response
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error message' },
          error: { type: 'string' },
        },
      },
      // Success Response
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      // Pagination Meta
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 100 },
          totalPages: { type: 'integer', example: 5 },
          hasNextPage: { type: 'boolean', example: true },
          hasPrevPage: { type: 'boolean', example: false },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Access token is missing or invalid',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              message: 'Authentication required',
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              message: 'Resource not found',
            },
          },
        },
      },
      ValidationError: {
        description: 'Validation failed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              message: 'Validation error',
              errors: [{ field: 'email', message: 'Invalid email format' }],
            },
          },
        },
      },
      RateLimitError: {
        description: 'Too many requests',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              message: 'Too many requests, please try again later',
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
