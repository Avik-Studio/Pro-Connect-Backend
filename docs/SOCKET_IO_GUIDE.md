# Socket.IO Real-Time Messaging Guide

## The Issue (Fixed! ✅)

**Problem:** Messages sent via HTTP POST API were not appearing instantly for other users. They only showed up after refreshing the page.

**Root Cause:** The chat controller's HTTP endpoints were saving messages to the database but **NOT emitting Socket.IO events** to notify connected users in real-time.

**Solution:** Added Socket.IO event emission to all chat controller endpoints.

---

## What Was Fixed

### Files Modified:
- [`src/controllers/chatController.ts`](../src/controllers/chatController.ts)

### Changes Made:

1. **Import Socket.IO helper:**
   ```typescript
   import { emitToConversation } from '../socket';
   ```

2. **Send Message (POST /messages):**
   - Now emits `new-message` event to all users in the conversation
   - Event triggers immediately when message is saved to database

3. **Delete Message (DELETE /messages/:id):**
   - Now emits `message-deleted` event
   - All users see the deletion in real-time

4. **Edit Message (PATCH /messages/:id):**
   - Now emits `message-updated` event
   - All users see the edit in real-time

5. **Mark as Seen (POST /seen):**
   - Now emits `messages-seen` event
   - Other users see read receipts instantly

---

## How Real-Time Messaging Works Now

### Architecture Flow:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   User A    │         │   Backend   │         │   User B    │
│  (Sender)   │         │   Server    │         │ (Receiver)  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ 1. POST /messages     │                       │
       ├──────────────────────>│                       │
       │                       │                       │
       │                  2. Save to DB                │
       │                       │                       │
       │                  3. Emit Socket Event         │
       │                       ├──────────────────────>│
       │                       │   'new-message'       │
       │                       │                       │
       │ 4. HTTP Response      │   5. Message appears  │
       │<──────────────────────┤      instantly! ✅    │
       │                       │                       │
```

---

## Frontend Integration Guide

### 1. Connect to Socket.IO

```javascript
import io from 'socket.io-client';

// Initialize socket connection
const socket = io('http://localhost:3000', {
  auth: {
    token: accessToken  // JWT access token
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to Socket.IO');
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

### 2. Join a Conversation

Before you can receive messages, join the conversation room:

```javascript
function joinConversation(conversationId) {
  socket.emit('join-conversation', conversationId);
  console.log('Joined conversation:', conversationId);
}

// Call this when user opens a chat
joinConversation('6975b79a0d50ac5334dc661e');
```

### 3. Listen for New Messages

```javascript
socket.on('new-message', (data) => {
  console.log('📩 New message received:', data);
  
  const { message, conversationId } = data;
  
  // Add message to your chat UI
  if (conversationId === currentConversationId) {
    addMessageToUI(message);
    
    // Mark as seen if user is viewing the conversation
    markMessagesAsSeen(conversationId);
  } else {
    // Show notification for other conversations
    showNotification(message);
    updateUnreadCount(conversationId);
  }
});
```

### 4. Send Messages (Two Ways)

#### Method A: Via HTTP API (Recommended)
```javascript
async function sendMessage(conversationId, content, messageType = 'text') {
  try {
    const response = await fetch(
      `http://localhost:3000/api/v1/chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          content,
          messageType
        })
      }
    );
    
    const data = await response.json();
    console.log('✅ Message sent:', data.data.message);
    
    // Message will automatically appear for other users via Socket.IO!
    return data.data.message;
  } catch (error) {
    console.error('❌ Error sending message:', error);
  }
}
```

#### Method B: Via Socket.IO (Alternative)
```javascript
socket.emit('send-message', {
  conversationId: '6975b79a0d50ac5334dc661e',
  content: 'Hello!',
  messageType: 'text'
}, (response) => {
  if (response.success) {
    console.log('✅ Message sent:', response.message);
  } else {
    console.error('❌ Error:', response.error);
  }
});
```

### 5. Listen for Message Updates

```javascript
// Message edited
socket.on('message-updated', (data) => {
  console.log('✏️ Message updated:', data);
  const { message, conversationId } = data;
  updateMessageInUI(message);
});

// Message deleted
socket.on('message-deleted', (data) => {
  console.log('🗑️ Message deleted:', data);
  const { messageId, conversationId, deleteForEveryone } = data;
  removeMessageFromUI(messageId);
});

// Messages seen (read receipts)
socket.on('messages-seen', (data) => {
  console.log('👁️ Messages seen:', data);
  const { conversationId, userId, seenAt } = data;
  updateReadReceipts(conversationId, userId, seenAt);
});
```

### 6. Typing Indicators

```javascript
// Show when user is typing
function onTyping(conversationId) {
  socket.emit('typing-start', conversationId);
}

// Stop typing indicator
function onStopTyping(conversationId) {
  socket.emit('typing-stop', conversationId);
}

// Listen for other users typing
socket.on('user-typing', (data) => {
  const { conversationId, userId, username } = data;
  showTypingIndicator(username);
});

socket.on('user-stop-typing', (data) => {
  const { conversationId, userId } = data;
  hideTypingIndicator(userId);
});

// Example: Implement in input field
let typingTimeout;
messageInput.addEventListener('input', () => {
  socket.emit('typing-start', conversationId);
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing-stop', conversationId);
  }, 1000);
});
```

### 7. Leave Conversation

```javascript
function leaveConversation(conversationId) {
  socket.emit('leave-conversation', conversationId);
  console.log('Left conversation:', conversationId);
}

// Call this when user closes chat or navigates away
```

### 8. User Presence (Online/Offline Status)

```javascript
socket.on('user-status-changed', (data) => {
  const { userId, isOnline, lastSeen } = data;
  updateUserStatus(userId, isOnline, lastSeen);
});
```

---

## Complete React/Next.js Example

```typescript
// hooks/useSocket.ts
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export function useSocket(token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socketInstance = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('✅ Socket connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return { socket, isConnected };
}
```

```typescript
// components/Chat.tsx
import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

interface Message {
  _id: string;
  content: string;
  sender: {
    _id: string;
    displayName: string;
    avatar?: string;
  };
  createdAt: string;
  messageType: string;
}

export function Chat({ conversationId, accessToken }) {
  const { socket, isConnected } = useSocket(accessToken);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    if (!socket || !conversationId) return;

    // Join conversation
    socket.emit('join-conversation', conversationId);

    // Listen for new messages
    socket.on('new-message', (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => [...prev, data.message]);
        
        // Mark as seen
        fetch(`/api/v1/chat/conversations/${conversationId}/seen`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
      }
    });

    // Listen for message updates
    socket.on('message-updated', (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev =>
          prev.map(msg =>
            msg._id === data.message._id ? data.message : msg
          )
        );
      }
    });

    // Listen for message deletions
    socket.on('message-deleted', (data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev =>
          prev.filter(msg => msg._id !== data.messageId)
        );
      }
    });

    // Cleanup
    return () => {
      socket.emit('leave-conversation', conversationId);
      socket.off('new-message');
      socket.off('message-updated');
      socket.off('message-deleted');
    };
  }, [socket, conversationId]);

  const sendMessage = async () => {
    if (!messageInput.trim()) return;

    try {
      const response = await fetch(
        `/api/v1/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            content: messageInput,
            messageType: 'text'
          })
        }
      );

      if (response.ok) {
        setMessageInput('');
        // Message will appear via socket event!
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="status">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      <div className="messages">
        {messages.map(msg => (
          <div key={msg._id} className="message">
            <strong>{msg.sender.displayName}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <div className="input">
        <input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
```

---

## Testing the Fix

### Test 1: Real-Time Messaging

1. **Open two browser windows/tabs:**
   - Window A: Login as User A, open conversation
   - Window B: Login as User B, open same conversation

2. **Test sending messages:**
   ```bash
   # From Window A, send via API or UI
   curl -X POST http://localhost:3000/api/v1/chat/conversations/{conversationId}/messages \
     -H "Authorization: Bearer {token_A}" \
     -H "Content-Type: application/json" \
     -d '{"content": "Hello from User A!", "messageType": "text"}'
   ```

3. **Expected Result:**
   - ✅ Window A: Message appears immediately
   - ✅ Window B: Message appears **instantly WITHOUT refresh**
   - ✅ Console shows: "📡 Real-time event emitted to conversation"

### Test 2: Check Socket Connection

Open browser DevTools console:

```javascript
// Check if socket is connected
socket.connected // Should be true

// Check active rooms
socket.rooms // Should include conversation rooms

// Test emission
socket.emit('join-conversation', 'conversation_id');
```

### Test 3: Monitor Events in DevTools

1. Open **Network tab** in DevTools
2. Filter by `WS` (WebSocket)
3. Click on the Socket.IO connection
4. View **Messages** tab to see real-time events

---

## Common Issues & Troubleshooting

### Issue 1: Messages still not appearing instantly

**Check:**
1. Is Socket.IO connected? → Check browser console for connection logs
2. Did you join the conversation? → `socket.emit('join-conversation', conversationId)`
3. Is the conversation ID correct?

**Debug:**
```javascript
socket.on('connect', () => console.log('✅ Connected'));
socket.on('disconnect', () => console.log('❌ Disconnected'));
socket.on('new-message', (data) => console.log('📩 Received:', data));
```

### Issue 2: "Authentication required" error

**Solution:** Pass the JWT token when connecting:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: accessToken }
});
```

### Issue 3: CORS errors

**Solution:** Ensure your frontend URL is whitelisted in [.env](../.env):
```env
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

### Issue 4: Socket disconnects frequently

**Solution:** Check your network and increase timeouts:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: accessToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
  timeout: 20000
});
```

### Issue 5: Not receiving events for all conversations

**Solution:** Make sure you're joining each conversation:
```javascript
// When opening a conversation
socket.emit('join-conversation', conversationId);

// When switching conversations
socket.emit('leave-conversation', oldConversationId);
socket.emit('join-conversation', newConversationId);
```

---

## Backend Logs

When a message is sent, you should see these logs:

```
📤 [CHAT] POST /conversations/:id/messages
👤 User ID: 6975b79a0d50ac5334dc661e
🎯 Conversation ID: 697abc123...
✅ Message sent. ID: 697def456...
📡 Real-time event emitted to conversation: 697abc123...
```

---

## Performance Tips

1. **Debounce typing indicators:**
   ```javascript
   const debouncedTyping = debounce(() => {
     socket.emit('typing-stop', conversationId);
   }, 1000);
   ```

2. **Lazy load old messages:** Load messages on scroll, not all at once

3. **Disconnect when not in use:**
   ```javascript
   // When app goes to background
   document.addEventListener('visibilitychange', () => {
     if (document.hidden) {
       socket.disconnect();
     } else {
       socket.connect();
     }
   });
   ```

4. **Use connection pooling:** Reuse socket connection across components

---

## Summary

### ✅ What's Fixed:
- Messages appear **instantly** without refresh
- All HTTP endpoints now emit Socket.IO events
- Real-time updates for send, edit, delete, and seen

### 📝 What You Need to Do:
1. **Restart your backend server** (the fix is in the code)
2. **Update your frontend** to listen for Socket.IO events
3. **Join conversations** before expecting to receive messages
4. **Test with two users** in different browsers

### 🎯 Key Events to Listen For:
- `new-message` - New message received
- `message-updated` - Message edited
- `message-deleted` - Message deleted
- `messages-seen` - Read receipts
- `user-typing` / `user-stop-typing` - Typing indicators
- `user-status-changed` - Online/offline status

---

## Next Steps

1. ✅ Backend fix applied - Restart server: `npm run dev`
2. ⚠️ Update frontend to use Socket.IO properly (see examples above)
3. ✅ Test with multiple users
4. 🎉 Enjoy real-time messaging!

For more details, see:
- [API Documentation](./API_DOCUMENTATION.md)
- [Socket.IO Official Docs](https://socket.io/docs/v4/)
