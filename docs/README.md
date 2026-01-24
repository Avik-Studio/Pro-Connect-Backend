# ProConnect API Documentation

Welcome to the ProConnect backend documentation. This folder contains comprehensive guides for setting up and configuring all components of the application.

## 📚 Documentation Index

### Environment Setup
- **[ENV_SETUP.md](./ENV_SETUP.md)** - Complete guide to all environment variables

### OAuth & Authentication
- **[GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)** - Google OAuth 2.0 configuration
- **[APPLE_OAUTH_SETUP.md](./APPLE_OAUTH_SETUP.md)** - Apple Sign In setup

### Cloud Services
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** - Firebase Cloud Messaging (FCM) for push notifications
- **[CLOUDINARY_SETUP.md](./CLOUDINARY_SETUP.md)** - Cloudinary media storage setup
- **[AWS_S3_SETUP.md](./AWS_S3_SETUP.md)** - AWS S3 media storage (alternative to Cloudinary)

### Infrastructure
- **[TURN_SERVER_SETUP.md](./TURN_SERVER_SETUP.md)** - TURN/STUN server for WebRTC calls

---

## 🚀 Quick Start

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/your-org/proconnect-backend.git
cd proconnect-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start development server**
```bash
npm run dev
```

### Minimum Required Environment Variables

For basic development, you need:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/proconnect
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-development-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

---

## 📖 API Documentation (Swagger)

Once the server is running, access the interactive API documentation at:

```
http://localhost:5000/api-docs
```

Features:
- Interactive API explorer
- Request/response examples
- Authentication testing
- Schema documentation

---

## 🔧 Service Dependencies

| Service | Purpose | Required | Guide |
|---------|---------|----------|-------|
| MongoDB | Database | ✅ Yes | [ENV_SETUP.md](./ENV_SETUP.md#database-configuration) |
| Redis | Caching, Pub/Sub | ✅ Yes | [ENV_SETUP.md](./ENV_SETUP.md#redis-configuration) |
| Google OAuth | Social login | ❌ Optional | [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) |
| Apple OAuth | Social login | ❌ Optional | [APPLE_OAUTH_SETUP.md](./APPLE_OAUTH_SETUP.md) |
| Firebase | Push notifications | ❌ Optional | [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) |
| Cloudinary | Media storage | ❌ Optional | [CLOUDINARY_SETUP.md](./CLOUDINARY_SETUP.md) |
| AWS S3 | Media storage | ❌ Optional | [AWS_S3_SETUP.md](./AWS_S3_SETUP.md) |
| TURN Server | WebRTC relay | ❌ Optional | [TURN_SERVER_SETUP.md](./TURN_SERVER_SETUP.md) |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Clients                                 │
│    (Web App, iOS App, Android App)                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Load Balancer / Nginx                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│  Node.js  │  │  Node.js  │  │  Node.js  │
│ Instance 1│  │ Instance 2│  │ Instance N│
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
┌─────────┐   ┌───────────┐   ┌─────────────┐
│ MongoDB │   │   Redis   │   │  Cloudinary │
│ Cluster │   │  Cluster  │   │   / AWS S3  │
└─────────┘   └───────────┘   └─────────────┘
```

---

## 🔐 Security Checklist

- [ ] All secrets stored in environment variables
- [ ] JWT secrets are strong and unique per environment
- [ ] HTTPS enabled in production
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] OAuth redirect URIs properly restricted
- [ ] Database connections use authentication
- [ ] Redis password protected
- [ ] TURN server has authentication enabled

---

## 📞 Support

For issues or questions:
1. Check the relevant documentation file
2. Search existing GitHub issues
3. Create a new issue with detailed information

---

## 📝 Contributing to Documentation

When adding new documentation:
1. Use clear, step-by-step instructions
2. Include screenshots where helpful
3. Provide code examples
4. Link to official documentation
5. Update this README index
