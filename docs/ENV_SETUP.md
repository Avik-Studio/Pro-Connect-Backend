# Environment Variables Documentation

This document provides a comprehensive guide on obtaining and configuring all environment variables required for the ProConnect backend application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment File Structure](#environment-file-structure)
3. [Database Configuration](#database-configuration)
4. [Redis Configuration](#redis-configuration)
5. [JWT & Authentication](#jwt--authentication)
6. [OAuth Providers](#oauth-providers)
7. [Cloud Storage](#cloud-storage)
8. [Push Notifications](#push-notifications)
9. [WebRTC Configuration](#webrtc-configuration)

---

## Quick Start

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in the required values following this guide
3. For development, minimum required variables are:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `REDIS_URL`

---

## Environment File Structure

```env
# ===========================================
# SERVER CONFIGURATION
# ===========================================
NODE_ENV=development          # development | staging | production
PORT=5000                     # Server port (default: 5000)
FRONTEND_URL=http://localhost:3000

# ===========================================
# DATABASE
# ===========================================
MONGODB_URI=mongodb://localhost:27017/proconnect

# ===========================================
# REDIS
# ===========================================
REDIS_URL=redis://localhost:6379

# ===========================================
# JWT AUTHENTICATION
# ===========================================
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ===========================================
# GOOGLE OAUTH
# ===========================================
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ===========================================
# APPLE OAUTH
# ===========================================
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-apple-private-key

# ===========================================
# CLOUDINARY
# ===========================================
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ===========================================
# AWS S3 (Optional - alternative to Cloudinary)
# ===========================================
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# ===========================================
# FIREBASE CLOUD MESSAGING
# ===========================================
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# ===========================================
# WEBRTC / TURN SERVER
# ===========================================
TURN_SERVER_URL=turn:your-turn-server:3478
TURN_SERVER_USERNAME=your-username
TURN_SERVER_CREDENTIAL=your-credential
```

---

## Database Configuration

### MongoDB Atlas (Recommended for Production)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account or sign in
3. Click **"Build a Database"**
4. Choose your cluster tier (Free M0 for development)
5. Select your cloud provider and region
6. Click **"Create Cluster"**
7. In Security Quickstart:
   - Create a database user with username/password
   - Add your IP address to the access list (or use 0.0.0.0/0 for development)
8. Click **"Connect"** → **"Connect your application"**
9. Copy the connection string:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/proconnect?retryWrites=true&w=majority
```

### Local MongoDB

For local development:
```env
MONGODB_URI=mongodb://localhost:27017/proconnect
```

Install MongoDB locally: [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)

---

## Redis Configuration

### Redis Cloud (Recommended for Production)

1. Go to [Redis Cloud](https://redis.com/try-free/)
2. Create a free account
3. Create a new subscription (free tier available)
4. Create a database
5. Copy the connection details:
```env
REDIS_URL=redis://default:password@redis-xxxxx.c1.us-east-1.ec2.cloud.redislabs.com:12345
```

### Local Redis

For local development:
```env
REDIS_URL=redis://localhost:6379
```

Install Redis locally:
- **macOS**: `brew install redis`
- **Ubuntu**: `sudo apt install redis-server`
- **Windows**: Use Docker or WSL

---

## JWT & Authentication

Generate secure secrets using one of these methods:

### Method 1: Node.js (Recommended)
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Method 2: OpenSSL
```bash
openssl rand -hex 64
```

### Method 3: Online Generator
Use [RandomKeygen](https://randomkeygen.com/) - use the "CodeIgniter Encryption Keys" section

**Example Configuration:**
```env
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
JWT_REFRESH_SECRET=z0y9x8w7v6u5t4s3r2q1p0o9n8m7l6k5j4i3h2g1f0e9d8c7b6a5z4y3x2w1v0u9
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

---

## OAuth Providers

See the following detailed guides:
- [Google OAuth Setup](./GOOGLE_OAUTH_SETUP.md)
- [Apple OAuth Setup](./APPLE_OAUTH_SETUP.md)

---

## Cloud Storage

See the following detailed guides:
- [Cloudinary Setup](./CLOUDINARY_SETUP.md)
- [AWS S3 Setup](./AWS_S3_SETUP.md)

---

## Push Notifications

See [Firebase Setup Guide](./FIREBASE_SETUP.md)

---

## WebRTC Configuration

See [TURN Server Setup Guide](./TURN_SERVER_SETUP.md)

---

## Security Best Practices

1. **Never commit `.env` files to version control**
2. **Use different secrets for each environment**
3. **Rotate secrets periodically**
4. **Use environment variable management tools in production:**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Secret Manager

---

## Troubleshooting

### Common Issues

1. **MongoDB Connection Errors**
   - Verify IP whitelist settings
   - Check username/password encoding
   - Ensure cluster is running

2. **Redis Connection Errors**
   - Verify Redis server is running
   - Check port and password
   - Ensure firewall allows connection

3. **OAuth Errors**
   - Verify redirect URIs match exactly
   - Check client ID and secret
   - Ensure OAuth consent screen is configured

For more help, check the individual setup guides or open an issue on GitHub.
