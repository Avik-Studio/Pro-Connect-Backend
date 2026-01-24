# TURN Server Setup Guide

This guide walks you through setting up a TURN server for WebRTC connectivity in ProConnect.

## What is TURN?

**TURN (Traversal Using Relays around NAT)** servers relay media between WebRTC peers when direct peer-to-peer connection is not possible due to:
- Symmetric NAT
- Restrictive firewalls
- Enterprise networks

**STUN (Session Traversal Utilities for NAT)** servers help discover public IP addresses but don't relay traffic.

---

## Options Overview

| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| Google STUN | Free, reliable | STUN only, no relay | Development |
| Coturn (Self-hosted) | Free, full control | Requires server management | Production |
| Twilio | Managed, reliable | Paid | Quick production setup |
| Xirsys | Managed, global | Paid | Enterprise |
| Metered | Pay-per-use | Paid | Variable usage |

---

## Option 1: Google STUN (Development Only)

For development, you can use Google's free STUN servers:

```env
# .env
STUN_SERVER_URL=stun:stun.l.google.com:19302
```

**Note**: STUN servers don't relay traffic, so connections may fail in restrictive networks.

```typescript
// WebRTC configuration
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];
```

---

## Option 2: Coturn (Self-Hosted) - Recommended

### Install on Ubuntu/Debian

```bash
# Update packages
sudo apt update

# Install coturn
sudo apt install coturn -y

# Enable coturn as a system service
sudo nano /etc/default/coturn
# Uncomment: TURNSERVER_ENABLED=1
```

### Configure Coturn

Edit `/etc/turnserver.conf`:

```conf
# Network settings
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=YOUR_SERVER_PUBLIC_IP

# Relay settings
min-port=49152
max-port=65535
relay-ip=YOUR_SERVER_PUBLIC_IP

# Authentication
lt-cred-mech
user=proconnect:your-secure-password

# Realm (your domain)
realm=your-domain.com
server-name=your-domain.com

# TLS certificates (recommended)
cert=/etc/letsencrypt/live/your-domain.com/fullchain.pem
pkey=/etc/letsencrypt/live/your-domain.com/privkey.pem

# Logging
log-file=/var/log/turnserver.log
verbose

# Security
no-multicast-peers
no-cli
no-tlsv1
no-tlsv1_1

# Quotas
total-quota=100
user-quota=10
max-bps=1000000

# Fingerprint
fingerprint
```

### Start Coturn

```bash
# Restart coturn
sudo systemctl restart coturn

# Enable on boot
sudo systemctl enable coturn

# Check status
sudo systemctl status coturn

# View logs
sudo tail -f /var/log/turnserver.log
```

### Firewall Configuration

```bash
# Open required ports
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
```

### Environment Variables

```env
TURN_SERVER_URL=turn:your-server-ip:3478
TURN_SERVER_USERNAME=proconnect
TURN_SERVER_CREDENTIAL=your-secure-password

# If using TLS
TURNS_SERVER_URL=turns:your-domain.com:5349
```

---

## Option 3: Twilio (Managed)

### Setup

1. Go to [Twilio Console](https://console.twilio.com/)
2. Create account or sign in
3. Navigate to **"Network Traversal"**
4. Note your Account SID and Auth Token

### Get Temporary Credentials

```typescript
// Backend endpoint to get TURN credentials
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function getTurnCredentials() {
  const token = await client.tokens.create();
  return {
    iceServers: token.iceServers,
    ttl: token.ttl,
  };
}
```

### Environment Variables

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
```

---

## Option 4: Metered TURN (Pay-per-use)

### Setup

1. Go to [Metered](https://www.metered.ca/)
2. Create account
3. Create an app
4. Get your API key and TURN credentials

### Environment Variables

```env
METERED_TURN_URL=turn:a.relay.metered.ca:80
METERED_TURN_USERNAME=xxxxxxxxxxxxxxxxxx
METERED_TURN_CREDENTIAL=xxxxxxxxxxxxxxxx
```

---

## Implementation

### Backend Configuration

```typescript
// src/config/webrtc.ts
interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export function getIceServers(): IceServer[] {
  const servers: IceServer[] = [
    // STUN servers (free)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // Add TURN server if configured
  if (process.env.TURN_SERVER_URL) {
    servers.push({
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_SERVER_USERNAME,
      credential: process.env.TURN_SERVER_CREDENTIAL,
    });
  }

  // Add TURNS (TLS) if configured
  if (process.env.TURNS_SERVER_URL) {
    servers.push({
      urls: process.env.TURNS_SERVER_URL,
      username: process.env.TURN_SERVER_USERNAME,
      credential: process.env.TURN_SERVER_CREDENTIAL,
    });
  }

  return servers;
}
```

### API Endpoint for ICE Servers

```typescript
// src/routes/webrtc.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getIceServers } from '../config/webrtc';

const router = Router();

router.get('/ice-servers', authenticate, (req, res) => {
  const iceServers = getIceServers();
  res.json({ iceServers });
});

export default router;
```

### Frontend Usage

```typescript
// Fetch ICE servers from backend
async function getWebRTCConfig() {
  const response = await fetch('/api/v1/webrtc/ice-servers');
  const { iceServers } = await response.json();
  return { iceServers };
}

// Create peer connection
async function createPeerConnection() {
  const config = await getWebRTCConfig();
  const pc = new RTCPeerConnection(config);
  return pc;
}
```

---

## Testing TURN Server

### Using Trickle ICE

1. Go to [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
2. Add your TURN server:
   ```
   turn:your-server:3478
   ```
3. Enter username and credential
4. Click **"Gather candidates"**
5. Look for `relay` candidates (indicates TURN is working)

### Command Line Test

```bash
# Install turnutils
sudo apt install coturn

# Test TURN server
turnutils_uclient -u proconnect -w your-password your-server-ip
```

### Programmatic Test

```javascript
async function testTurnServer() {
  const pc = new RTCPeerConnection({
    iceServers: [{
      urls: 'turn:your-server:3478',
      username: 'proconnect',
      credential: 'your-password'
    }]
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      console.log('Candidate:', e.candidate.type, e.candidate.candidate);
      if (e.candidate.type === 'relay') {
        console.log('✅ TURN server is working!');
      }
    }
  };

  const dc = pc.createDataChannel('test');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
}
```

---

## Docker Deployment

### Dockerfile for Coturn

```dockerfile
FROM coturn/coturn:latest

COPY turnserver.conf /etc/turnserver.conf

EXPOSE 3478 3478/udp 5349 5349/udp 49152-65535/udp

CMD ["turnserver", "-c", "/etc/turnserver.conf"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  turn:
    image: coturn/coturn:latest
    container_name: proconnect-turn
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./turnserver.conf:/etc/turnserver.conf:ro
      - ./certs:/etc/letsencrypt:ro
    command: turnserver -c /etc/turnserver.conf
```

---

## Security Best Practices

1. **Use TLS (TURNS) in production**
   - Encrypt media relay traffic
   - Use valid SSL certificates

2. **Enable authentication**
   - Use long-term credentials (`lt-cred-mech`)
   - Or use time-limited credentials

3. **Set quotas**
   - Limit bandwidth per user
   - Limit total relay sessions

4. **Restrict allowed IPs** (if known)
   ```conf
   allowed-peer-ip=192.168.0.0-192.168.255.255
   denied-peer-ip=0.0.0.0-0.255.255.255
   ```

5. **Monitor usage**
   - Check logs regularly
   - Set up alerts for unusual traffic

6. **Rotate credentials**
   - Change passwords periodically
   - Use short-lived tokens if possible

---

## Time-Limited Credentials (Recommended)

### Generate HMAC-Based Credentials

```typescript
import crypto from 'crypto';

function generateTurnCredentials(userId: string): {
  username: string;
  credential: string;
  ttl: number;
} {
  const secret = process.env.TURN_SECRET!;
  const ttl = 86400; // 24 hours
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  
  const username = `${timestamp}:${userId}`;
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(username);
  const credential = hmac.digest('base64');

  return { username, credential, ttl };
}
```

### Coturn Configuration for HMAC

```conf
# turnserver.conf
use-auth-secret
static-auth-secret=your-shared-secret
```

---

## Troubleshooting

### Common Issues

1. **No relay candidates**
   - Check firewall ports are open
   - Verify external-ip is correctly set
   - Test with `turnutils_uclient`

2. **Authentication failed**
   - Verify username/password
   - Check realm matches
   - Ensure `lt-cred-mech` is enabled

3. **Connection timeout**
   - Check UDP ports are open
   - Verify TURN server is running
   - Test network connectivity

4. **Poor call quality**
   - Check bandwidth quotas
   - Monitor server resources
   - Consider geographic distribution

### Debug Mode

```conf
# turnserver.conf
verbose
log-file=/var/log/turnserver.log
```

```bash
# Watch logs in real-time
sudo tail -f /var/log/turnserver.log
```

---

## Monitoring

### Prometheus Metrics

Coturn exposes metrics at `/metrics` endpoint:

```conf
# turnserver.conf
prometheus
```

### Health Check Endpoint

```typescript
// Check TURN server health
async function checkTurnHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [{
        urls: process.env.TURN_SERVER_URL!,
        username: process.env.TURN_SERVER_USERNAME,
        credential: process.env.TURN_SERVER_CREDENTIAL,
      }]
    });

    let hasRelay = false;
    
    pc.onicecandidate = (e) => {
      if (e.candidate?.type === 'relay') {
        hasRelay = true;
      }
      if (!e.candidate) {
        pc.close();
        resolve(hasRelay);
      }
    };

    pc.createDataChannel('healthcheck');
    pc.createOffer().then(o => pc.setLocalDescription(o));
    
    setTimeout(() => {
      pc.close();
      resolve(hasRelay);
    }, 10000);
  });
}
```

---

## Additional Resources

- [Coturn Documentation](https://github.com/coturn/coturn)
- [WebRTC TURN Server Guide](https://webrtc.org/getting-started/turn-server)
- [Twilio Network Traversal](https://www.twilio.com/docs/stun-turn)
- [ICE, STUN, TURN Explained](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols)
