# 🚀 ProConnect Backend

A production-ready, scalable backend for real-time messaging and audio/video calling applications. Built with Node.js, Express, TypeScript, Socket.IO, and WebRTC signaling.

## 📋 Features

### ✅ Authentication & Authorization
- JWT-based authentication with access/refresh token rotation
- Google & Apple OAuth integration
- Session management with multiple device support
- Role-based access control (RBAC)
- Rate limiting and brute-force protection

### 💬 Real-time Messaging
- Private 1-on-1 conversations
- Group chats with admin controls
- Message types: text, images, videos, audio, files, location
- Typing indicators
- Read/delivery receipts
- Message editing and deletion
- Search functionality

### 📞 Audio/Video Calling
- WebRTC-based peer-to-peer calling
- STUN/TURN server integration (Coturn)
- 1-on-1 and group calls
- Call history tracking
- Missed call notifications

### 👥 Group Management
- Create/edit/delete groups
- Member roles (owner, admin, member)
- Invite links with expiration
- Group settings (privacy, permissions)
- Ownership transfer

### 📱 Push Notifications
- Firebase Cloud Messaging (FCM)
- Message notifications
- Call notifications
- Customizable notification settings

### 📁 Media Handling
- Cloudinary integration for images/videos
- AWS S3 support for files
- Signed upload URLs
- File validation and size limits

### 🔒 Security
- Helmet security headers
- CORS configuration
- Input validation with Zod
- Password hashing with bcrypt
- SQL/NoSQL injection prevention

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript 5.x |
| Framework | Express.js 4.x |
| Database | MongoDB with Mongoose |
| Cache/Pubsub | Redis with ioredis |
| Real-time | Socket.IO 4.x |
| WebRTC | STUN (Google) + TURN (Coturn) |
| Auth | JWT, Passport.js |
| Validation | Zod |
| Logging | Pino |
| Storage | Cloudinary, AWS S3 |
| Notifications | Firebase Admin SDK |
| Containerization | Docker, Docker Compose |

## 📁 Project Structure

```
proconnect-backend/
├── src/
│   ├── config/           # Configuration (env, database, redis)
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── models/           # MongoDB schemas
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── socket/           # Socket.IO handlers
│   ├── types/            # TypeScript types
│   ├── utils/            # Utilities and helpers
│   └── index.ts          # Application entry point
├── logs/                 # Application logs
├── docker-compose.yml    # Docker services
├── Dockerfile           # App container
├── turnserver.conf      # Coturn configuration
├── .env.example         # Environment template
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 7+
- Docker & Docker Compose (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd proconnect-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start development server**
```bash
npm run dev
```

### Docker Setup

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 3000 |
| `MONGODB_URI` | MongoDB connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JWT_ACCESS_SECRET` | Access token secret | - |
| `JWT_REFRESH_SECRET` | Refresh token secret | - |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | - |
| `AWS_S3_BUCKET` | S3 bucket name | - |
| `FIREBASE_PROJECT_ID` | Firebase project ID | - |
| `TURN_SERVER_URL` | TURN server URL | - |

See `.env.example` for all options.

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login user |
| POST | `/auth/refresh` | Refresh tokens |
| POST | `/auth/logout` | Logout user |
| GET | `/auth/me` | Get current user |
| GET | `/auth/sessions` | Get active sessions |

#### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/profile` | Get profile |
| PATCH | `/users/profile` | Update profile |
| GET | `/users/search` | Search users |
| POST | `/users/fcm-token` | Add FCM token |

#### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chat/conversations` | Get conversations |
| POST | `/chat/conversations/private` | Create/get private chat |
| GET | `/chat/conversations/:id/messages` | Get messages |
| POST | `/chat/conversations/:id/messages` | Send message |

#### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/groups` | Create group |
| GET | `/groups` | Get user's groups |
| PATCH | `/groups/:id` | Update group |
| POST | `/groups/:id/members` | Add members |

#### Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/calls` | Initiate call |
| GET | `/calls/history` | Get call history |
| POST | `/calls/:id/accept` | Accept call |
| POST | `/calls/:id/end` | End call |

### Socket.IO Events

#### Client → Server
| Event | Description |
|-------|-------------|
| `join-conversation` | Join chat room |
| `send-message` | Send message |
| `typing-start` | Start typing indicator |
| `call-initiate` | Start a call |
| `call-offer` | WebRTC offer |
| `call-answer` | WebRTC answer |
| `ice-candidate` | ICE candidate |

#### Server → Client
| Event | Description |
|-------|-------------|
| `new-message` | New message received |
| `user-typing` | User is typing |
| `incoming-call` | Incoming call |
| `call-accepted` | Call was accepted |
| `presence-update` | User online status |

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 🔍 Logging

Logs are managed by Pino and stored in:
- `logs/app.log` - Application logs
- `logs/error.log` - Error logs

Log rotation is handled by the logging configuration.

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Node.js application |
| mongo | 27017 | MongoDB database |
| redis | 6379 | Redis cache |
| coturn | 3478, 5349 | TURN server |

## 🔐 Security Best Practices

1. **Never commit `.env` files**
2. **Use strong JWT secrets** (min 256 bits)
3. **Enable HTTPS in production**
4. **Configure CORS properly**
5. **Keep dependencies updated**
6. **Use rate limiting**
7. **Validate all inputs**

## 📊 Monitoring

The application exposes health check endpoints:

- `GET /health` - Basic health check
- `GET /ready` - Readiness check (DB + Redis)

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production MongoDB URI
- [ ] Configure production Redis URL
- [ ] Set secure JWT secrets
- [ ] Configure Cloudinary/S3 credentials
- [ ] Set up Firebase credentials
- [ ] Configure TURN server
- [ ] Enable HTTPS
- [ ] Set up reverse proxy (nginx)
- [ ] Configure firewall rules

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

Built with ❤️ for real-time communication
