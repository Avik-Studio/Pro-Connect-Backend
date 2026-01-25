# ProConnect API Documentation for Frontend Integration

## Base URL
```
http://localhost:3000/api/v1
```

## Table of Contents
1. [Authentication](#authentication)
2. [Users](#users)
3. [Chat & Messaging](#chat--messaging)
4. [Groups](#groups)
5. [Calls](#calls)
6. [Media](#media)
7. [WebSocket Events](#websocket-events)
8. [Error Handling](#error-handling)

---

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_access_token>
```

### Register User
**POST** `/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "john_doe",
  "displayName": "John Doe"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (@$!%*?&)

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "_id": "6975b79a0d50ac5334dc661e",
      "email": "user@example.com",
      "username": "john_doe",
      "displayName": "John Doe",
      "avatar": null,
      "bio": "",
      "isOnline": false,
      "lastSeen": "2026-01-25T06:17:16.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "accessTokenExpiry": "2026-01-25T06:32:16.000Z",
      "refreshTokenExpiry": "2026-02-01T06:17:16.000Z"
    }
  }
}
```

### Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { /* user object */ },
    "tokens": { /* tokens object */ }
  }
}
```

### Refresh Token
**POST** `/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
*Note: Can also be sent as cookie*

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "tokens": {
      "accessToken": "new_access_token",
      "refreshToken": "new_refresh_token",
      "accessTokenExpiry": "2026-01-25T06:47:16.000Z",
      "refreshTokenExpiry": "2026-02-01T06:32:16.000Z"
    }
  }
}
```

### Logout
**POST** `/auth/logout`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Change Password
**POST** `/auth/change-password`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Get Current User
**GET** `/auth/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6975b79a0d50ac5334dc661e",
      "email": "user@example.com",
      "username": "john_doe",
      "displayName": "John Doe",
      "avatar": "https://example.com/avatar.jpg",
      "bio": "Developer at XYZ",
      "isOnline": true,
      "lastSeen": "2026-01-25T06:17:16.000Z",
      "settings": {
        "notifications": {
          "push": true,
          "email": true,
          "messagePreview": true
        },
        "privacy": {
          "showOnlineStatus": true,
          "showLastSeen": true
        }
      }
    }
  }
}
```

---

## Users

### Get User Profile
**GET** `/users/profile`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { /* full user object */ }
  }
}
```

### Update Profile
**PATCH** `/users/profile`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "displayName": "John Smith",
  "bio": "Software Engineer",
  "avatar": "https://cloudinary.com/image.jpg",
  "phoneNumber": "+1234567890"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": { /* updated user object */ }
  }
}
```

### Update Settings
**PATCH** `/users/settings`

**Request Body:**
```json
{
  "notifications": {
    "push": true,
    "email": false,
    "messagePreview": true,
    "sound": true,
    "vibration": false
  },
  "privacy": {
    "showOnlineStatus": true,
    "showLastSeen": false,
    "showReadReceipts": true,
    "profilePhotoVisibility": "contacts",
    "aboutVisibility": "everyone"
  },
  "theme": "dark",
  "language": "en"
}
```

**Privacy Options:**
- `everyone` - Visible to all users
- `contacts` - Visible to contacts only
- `nobody` - Hidden from everyone

**Theme Options:** `light`, `dark`, `system`

### Update Username
**PATCH** `/users/username`

**Request Body:**
```json
{
  "username": "new_username"
}
```

**Username Requirements:**
- 3-30 characters
- Only letters, numbers, and underscores
- Must be unique

### Search Users
**GET** `/users/search?q=john&page=1&limit=20`

**Query Parameters:**
- `q` (required): Search query
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "user_id",
        "username": "john_doe",
        "displayName": "John Doe",
        "avatar": "url",
        "bio": "Developer"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Get User by ID
**GET** `/users/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id",
      "username": "john_doe",
      "displayName": "John Doe",
      "avatar": "url",
      "bio": "Developer",
      "isOnline": true,
      "lastSeen": "2026-01-25T06:17:16.000Z"
    }
  }
}
```

### Get Online Status
**POST** `/users/online-status`

**Request Body:**
```json
{
  "userIds": ["user_id_1", "user_id_2", "user_id_3"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "statuses": [
      {
        "userId": "user_id_1",
        "isOnline": true,
        "lastSeen": "2026-01-25T06:17:16.000Z"
      },
      {
        "userId": "user_id_2",
        "isOnline": false,
        "lastSeen": "2026-01-25T05:30:00.000Z"
      }
    ]
  }
}
```

### Add/Remove Contacts
**POST** `/users/:id/add-contact`
**DELETE** `/users/:id/remove-contact`

**Response (200):**
```json
{
  "success": true,
  "message": "Contact added/removed successfully"
}
```

### Block/Unblock User
**POST** `/users/:id/block`
**DELETE** `/users/:id/unblock`

**Response (200):**
```json
{
  "success": true,
  "message": "User blocked/unblocked successfully"
}
```

### Register FCM Token (for push notifications)
**POST** `/users/fcm-token`

**Request Body:**
```json
{
  "fcmToken": "firebase_cloud_messaging_token"
}
```

---

## Chat & Messaging

### Get All Conversations
**GET** `/chat/conversations?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "_id": "conversation_id",
        "type": "private",
        "participants": [
          {
            "_id": "user_id",
            "displayName": "John Doe",
            "avatar": "url",
            "isOnline": true
          }
        ],
        "lastMessage": {
          "_id": "message_id",
          "content": "Hello!",
          "sender": "user_id",
          "createdAt": "2026-01-25T06:17:16.000Z",
          "messageType": "text"
        },
        "unreadCount": 3,
        "isPinned": false,
        "isMuted": false,
        "updatedAt": "2026-01-25T06:17:16.000Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

### Create Private Conversation
**POST** `/chat/conversations/private`

**Request Body:**
```json
{
  "userId": "target_user_id"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Conversation retrieved successfully",
  "data": {
    "conversation": { /* conversation object */ }
  }
}
```

### Get Conversation by ID
**GET** `/chat/conversations/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "conversation": { /* conversation object */ }
  }
}
```

### Get Messages
**GET** `/chat/conversations/:id/messages?page=1&limit=50`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "message_id",
        "conversation": "conversation_id",
        "sender": {
          "_id": "user_id",
          "displayName": "John Doe",
          "avatar": "url"
        },
        "content": "Hello there!",
        "messageType": "text",
        "status": "delivered",
        "seenBy": [],
        "createdAt": "2026-01-25T06:17:16.000Z",
        "updatedAt": "2026-01-25T06:17:16.000Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 127,
    "totalPages": 3
  }
}
```

### Send Message
**POST** `/chat/conversations/:id/messages`

**Request Body (Text Message):**
```json
{
  "content": "Hello! How are you?",
  "messageType": "text"
}
```

**Request Body (Media Message):**
```json
{
  "content": "Check this out!",
  "messageType": "image",
  "media": [
    {
      "url": "https://cloudinary.com/image.jpg",
      "type": "image",
      "mimeType": "image/jpeg",
      "size": 245678,
      "width": 1920,
      "height": 1080,
      "thumbnail": "https://cloudinary.com/thumb.jpg"
    }
  ]
}
```

**Message Types:**
- `text` - Text message
- `image` - Image file
- `video` - Video file
- `audio` - Audio file
- `file` - Document/other file
- `location` - Location sharing
- `contact` - Contact card

**Request Body (Reply to Message):**
```json
{
  "content": "I agree!",
  "messageType": "text",
  "replyTo": "original_message_id"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": { /* message object */ }
  }
}
```

### Edit Message
**PATCH** `/chat/messages/:id`

**Request Body:**
```json
{
  "content": "Updated message content"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Message updated successfully",
  "data": {
    "message": { /* updated message */ }
  }
}
```

### Delete Message
**DELETE** `/chat/messages/:id`

**Request Body (optional):**
```json
{
  "deleteForEveryone": true
}
```
- `deleteForEveryone: true` - Deletes for all participants (within 24 hours)
- `deleteForEveryone: false` - Deletes only for you

**Response (200):**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

### Mark Messages as Seen
**POST** `/chat/conversations/:id/seen`

**Response (200):**
```json
{
  "success": true,
  "message": "Messages marked as seen"
}
```

### Pin/Unpin Conversation
**POST** `/chat/conversations/:id/pin`

**Response (200):**
```json
{
  "success": true,
  "message": "Conversation pinned/unpinned successfully"
}
```

### Mute/Unmute Conversation
**POST** `/chat/conversations/:id/mute`

**Request Body (Mute):**
```json
{
  "muteUntil": "2026-01-26T06:17:16.000Z"
}
```

**Request Body (Unmute):**
```json
{}
```

### Search Messages in Conversation
**GET** `/chat/conversations/:id/search?q=keyword&page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "messages": [ /* matching messages */ ]
  },
  "meta": { /* pagination */ }
}
```

### Delete Conversation
**DELETE** `/chat/conversations/:id`

**Response (200):**
```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

---

## Groups

### Create Group
**POST** `/groups`

**Request Body:**
```json
{
  "name": "Project Team",
  "description": "Our amazing project team",
  "avatar": "https://cloudinary.com/group-avatar.jpg",
  "members": ["user_id_1", "user_id_2", "user_id_3"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Group created successfully",
  "data": {
    "group": {
      "_id": "group_id",
      "name": "Project Team",
      "description": "Our amazing project team",
      "avatar": "url",
      "owner": "creator_user_id",
      "admins": ["creator_user_id"],
      "members": ["user_id_1", "user_id_2", "user_id_3"],
      "memberCount": 4,
      "createdAt": "2026-01-25T06:17:16.000Z"
    }
  }
}
```

### Get User's Groups
**GET** `/groups?page=1&limit=20`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "groups": [ /* array of group objects */ ]
  },
  "meta": { /* pagination */ }
}
```

### Get Group by ID
**GET** `/groups/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "group": { /* group object with full details */ }
  }
}
```

### Update Group
**PATCH** `/groups/:id`
*(Admin/Owner only)*

**Request Body:**
```json
{
  "name": "Updated Group Name",
  "description": "Updated description",
  "avatar": "new_avatar_url",
  "settings": {
    "onlyAdminsCanPost": false,
    "onlyAdminsCanEditInfo": true,
    "onlyAdminsCanAddMembers": false,
    "approvalRequired": false,
    "muteAllMembers": false,
    "maxMembers": 500
  }
}
```

### Add Members
**POST** `/groups/:id/members`

**Request Body:**
```json
{
  "members": ["user_id_1", "user_id_2"]
}
```

### Remove Member
**DELETE** `/groups/:id/members/:userId`
*(Admin/Owner only)*

### Leave Group
**POST** `/groups/:id/leave`

### Update Member Role
**PATCH** `/groups/:id/members/:userId/role`
*(Owner only)*

**Request Body:**
```json
{
  "role": "admin"
}
```
Roles: `admin`, `member`

### Transfer Ownership
**POST** `/groups/:id/transfer-ownership`
*(Owner only)*

**Request Body:**
```json
{
  "newOwnerId": "user_id"
}
```

### Get Group Invite Link
**GET** `/groups/:id/invite-link`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "inviteCode": "abc123xyz",
    "inviteUrl": "https://proconnect.com/groups/join/abc123xyz",
    "expiresAt": "2026-02-25T06:17:16.000Z"
  }
}
```

### Regenerate Invite Link
**POST** `/groups/:id/regenerate-invite`

**Request Body:**
```json
{
  "expiryDays": 30
}
```

### Join Group via Invite
**POST** `/groups/join/:inviteCode`

### Mute/Unmute Group
**POST** `/groups/:id/mute`

**Request Body:**
```json
{
  "muteUntil": "2026-01-26T06:17:16.000Z"
}
```

### Delete Group
**DELETE** `/groups/:id`
*(Owner only)*

---

## Calls

### Initiate Call
**POST** `/calls`

**Request Body (1-on-1 Call):**
```json
{
  "receiverId": "user_id",
  "callType": "video"
}
```

**Request Body (Group Call):**
```json
{
  "groupId": "group_id",
  "callType": "audio"
}
```

**Call Types:** `audio`, `video`

**Response (201):**
```json
{
  "success": true,
  "message": "Call initiated successfully",
  "data": {
    "call": {
      "_id": "call_id",
      "caller": "user_id",
      "receiver": "user_id",
      "callType": "video",
      "status": "ringing",
      "startedAt": "2026-01-25T06:17:16.000Z"
    }
  }
}
```

**Call Statuses:**
- `ringing` - Call initiated, waiting for answer
- `ongoing` - Call in progress
- `ended` - Call completed
- `missed` - Call not answered
- `rejected` - Call declined

### Get Active Call
**GET** `/calls/active`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "call": { /* active call object or null */ }
  }
}
```

### Accept Call
**POST** `/calls/:id/accept`

**Response (200):**
```json
{
  "success": true,
  "message": "Call accepted",
  "data": {
    "call": { /* updated call object */ }
  }
}
```

### Reject Call
**POST** `/calls/:id/reject`

**Request Body:**
```json
{
  "reason": "busy"
}
```
Reasons: `busy`, `declined`

### End Call
**POST** `/calls/:id/end`

**Request Body:**
```json
{
  "reason": "normal"
}
```
Reasons: `normal`, `busy`, `failed`, `no_answer`, `declined`, `network_error`

### Get Call History
**GET** `/calls/history?page=1&limit=20&type=video`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `type`: Filter by call type (`audio` or `video`)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "calls": [
      {
        "_id": "call_id",
        "caller": { /* user object */ },
        "receiver": { /* user object */ },
        "callType": "video",
        "status": "ended",
        "duration": 320,
        "startedAt": "2026-01-25T06:00:00.000Z",
        "endedAt": "2026-01-25T06:05:20.000Z"
      }
    ]
  },
  "meta": { /* pagination */ }
}
```

### Get Missed Calls Count
**GET** `/calls/missed-count?since=2026-01-24T00:00:00.000Z`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

### Get Call Details
**GET** `/calls/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "call": { /* full call object */ }
  }
}
```

---

## Media

### Upload File
**POST** `/media/upload`

**Headers:**
```
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: The file to upload (max 100MB)

**Supported File Types:**
- Images: JPEG, PNG, GIF, WebP
- Videos: MP4, WebM, QuickTime
- Audio: MP3, WAV, OGG, WebM
- Documents: PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP

**Example using FormData:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:3000/api/v1/media/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});
```

**Response (201):**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "media": {
      "url": "https://cloudinary.com/uploads/file.jpg",
      "publicId": "uploads/abc123",
      "mimeType": "image/jpeg",
      "size": 245678,
      "width": 1920,
      "height": 1080,
      "thumbnail": "https://cloudinary.com/uploads/file_thumb.jpg"
    }
  }
}
```

### Get Signed Upload URL
**POST** `/media/signed-url`
*(For direct client upload to cloud storage)*

**Request Body:**
```json
{
  "fileName": "photo.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 245678
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://cloudinary.com/signed-upload-url",
    "publicId": "uploads/abc123",
    "expiresAt": "2026-01-25T07:17:16.000Z"
  }
}
```

### Delete Media
**DELETE** `/media/:publicId`

**Response (200):**
```json
{
  "success": true,
  "message": "Media deleted successfully"
}
```

---

## WebSocket Events

### Connection
Connect to WebSocket server:
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: accessToken
  }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});
```

### Events to Emit

#### Join Conversation
```javascript
socket.emit('join-conversation', { conversationId: 'conversation_id' });
```

#### Leave Conversation
```javascript
socket.emit('leave-conversation', { conversationId: 'conversation_id' });
```

#### Typing Indicator
```javascript
// Start typing
socket.emit('typing', { conversationId: 'conversation_id' });

// Stop typing
socket.emit('stop-typing', { conversationId: 'conversation_id' });
```

### Events to Listen

#### New Message
```javascript
socket.on('new-message', (data) => {
  // data = { message: {...}, conversationId: '...' }
  console.log('New message:', data.message);
});
```

#### Message Updated
```javascript
socket.on('message-updated', (data) => {
  // data = { message: {...}, conversationId: '...' }
  console.log('Message updated:', data.message);
});
```

#### Message Deleted
```javascript
socket.on('message-deleted', (data) => {
  // data = { messageId: '...', conversationId: '...' }
  console.log('Message deleted:', data.messageId);
});
```

#### Message Seen
```javascript
socket.on('message-seen', (data) => {
  // data = { messageId: '...', seenBy: 'user_id', conversationId: '...' }
  console.log('Message seen by:', data.seenBy);
});
```

#### User Typing
```javascript
socket.on('user-typing', (data) => {
  // data = { userId: '...', conversationId: '...' }
  console.log('User typing:', data.userId);
});
```

#### User Stopped Typing
```javascript
socket.on('user-stopped-typing', (data) => {
  // data = { userId: '...', conversationId: '...' }
  console.log('User stopped typing:', data.userId);
});
```

#### User Online/Offline Status
```javascript
socket.on('user-status-changed', (data) => {
  // data = { userId: '...', isOnline: true/false }
  console.log('User status:', data);
});
```

#### Incoming Call
```javascript
socket.on('incoming-call', (data) => {
  // data = { call: {...} }
  console.log('Incoming call:', data.call);
});
```

#### Call Accepted
```javascript
socket.on('call-accepted', (data) => {
  // data = { callId: '...', acceptedBy: 'user_id' }
  console.log('Call accepted');
});
```

#### Call Rejected
```javascript
socket.on('call-rejected', (data) => {
  // data = { callId: '...', rejectedBy: 'user_id', reason: '...' }
  console.log('Call rejected');
});
```

#### Call Ended
```javascript
socket.on('call-ended', (data) => {
  // data = { callId: '...', endedBy: 'user_id', reason: '...' }
  console.log('Call ended');
});
```

### WebRTC Signaling Events

#### Offer
```javascript
// Send offer
socket.emit('webrtc-offer', {
  callId: 'call_id',
  offer: rtcSessionDescription
});

// Receive offer
socket.on('webrtc-offer', (data) => {
  // data = { callId: '...', offer: {...} }
});
```

#### Answer
```javascript
// Send answer
socket.emit('webrtc-answer', {
  callId: 'call_id',
  answer: rtcSessionDescription
});

// Receive answer
socket.on('webrtc-answer', (data) => {
  // data = { callId: '...', answer: {...} }
});
```

#### ICE Candidate
```javascript
// Send ICE candidate
socket.emit('webrtc-ice-candidate', {
  callId: 'call_id',
  candidate: iceCandidate
});

// Receive ICE candidate
socket.on('webrtc-ice-candidate', (data) => {
  // data = { callId: '...', candidate: {...} }
});
```

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

### Common Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate username) |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Error Codes

- `VALIDATION_ERROR` - Invalid input data
- `AUTHENTICATION_FAILED` - Invalid credentials
- `TOKEN_EXPIRED` - Access token expired
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ENTRY` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests

### Validation Errors
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "statusCode": 422,
    "details": [
      {
        "field": "email",
        "message": "Invalid email address"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication endpoints**: 5 requests per 15 minutes
- **Message sending**: 30 requests per minute
- **File uploads**: 10 requests per hour
- **General API**: 100 requests per 15 minutes

When rate limited, you'll receive a `429` status code:
```json
{
  "success": false,
  "error": {
    "message": "Too many requests, please try again later",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429,
    "retryAfter": 300
  }
}
```

---

## Best Practices

### 1. Token Management
- Store tokens securely (not in localStorage for sensitive apps)
- Implement automatic token refresh before expiry
- Handle token expiration gracefully

```javascript
// Example token refresh logic
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  const data = await response.json();
  saveTokens(data.data.tokens);
  return data.data.tokens.accessToken;
}
```

### 2. WebSocket Reconnection
```javascript
socket.on('disconnect', () => {
  console.log('Disconnected, attempting to reconnect...');
});

socket.on('connect', () => {
  console.log('Reconnected successfully');
  // Rejoin conversations
  rejoinActiveConversations();
});
```

### 3. Pagination
Always handle pagination for list endpoints:
```javascript
async function loadMessages(conversationId, page = 1) {
  const response = await fetch(
    `/api/v1/chat/conversations/${conversationId}/messages?page=${page}&limit=50`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  const data = await response.json();
  return {
    messages: data.data.messages,
    hasMore: data.meta.page < data.meta.totalPages
  };
}
```

### 4. Error Handling
```javascript
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try refresh
        const newToken = await refreshAccessToken();
        return apiRequest(url, options); // Retry
      }
      throw new Error(data.error.message);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}
```

### 5. Media Upload with Progress
```javascript
async function uploadFile(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 201) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error('Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    xhr.open('POST', '/api/v1/media/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.send(formData);
  });
}
```

---

## Example: Complete Chat Flow

```javascript
// 1. Connect to WebSocket
const socket = io('http://localhost:3000', {
  auth: { token: accessToken }
});

// 2. Get or create conversation
const response = await fetch('/api/v1/chat/conversations/private', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ userId: targetUserId })
});
const { data } = await response.json();
const conversationId = data.conversation._id;

// 3. Join conversation room
socket.emit('join-conversation', { conversationId });

// 4. Load messages
const messagesResponse = await fetch(
  `/api/v1/chat/conversations/${conversationId}/messages?page=1&limit=50`,
  {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }
);
const messagesData = await messagesResponse.json();
displayMessages(messagesData.data.messages);

// 5. Listen for new messages
socket.on('new-message', (data) => {
  if (data.conversationId === conversationId) {
    appendMessage(data.message);
  }
});

// 6. Send typing indicator
inputField.addEventListener('input', () => {
  socket.emit('typing', { conversationId });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stop-typing', { conversationId });
  }, 1000);
});

// 7. Send message
async function sendMessage(content) {
  const response = await fetch(
    `/api/v1/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        content,
        messageType: 'text'
      })
    }
  );
  return response.json();
}

// 8. Mark messages as seen
socket.on('connect', () => {
  fetch(`/api/v1/chat/conversations/${conversationId}/seen`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
});
```

---

## Support & Documentation

- **Interactive API Docs**: http://localhost:3000/api-docs (Swagger UI)
- **Health Check**: http://localhost:3000/health
- **API Version**: v1

For additional setup guides, see the `/docs` folder:
- [Environment Setup](./ENV_SETUP.md)
- [Firebase Setup](./FIREBASE_SETUP.md)
- [Google OAuth Setup](./GOOGLE_OAUTH_SETUP.md)
- [Cloudinary Setup](./CLOUDINARY_SETUP.md)
- [AWS S3 Setup](./AWS_S3_SETUP.md)
- [TURN Server Setup](./TURN_SERVER_SETUP.md)
