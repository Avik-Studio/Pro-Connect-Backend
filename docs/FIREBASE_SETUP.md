# Firebase Cloud Messaging (FCM) Setup Guide

This guide walks you through setting up Firebase Cloud Messaging for push notifications in ProConnect.

## Prerequisites

- A Google account
- Access to [Firebase Console](https://console.firebase.google.com/)

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** (or select an existing project)
3. Enter project name: `ProConnect`
4. (Optional) Enable Google Analytics
5. Click **"Create project"**
6. Wait for project creation and click **"Continue"**

---

## Step 2: Add Your Apps to Firebase

### For Android

1. Click on the **Android icon** in the Project Overview
2. Fill in the registration form:
   ```
   Android package name: com.proconnect.app
   App nickname: ProConnect Android (optional)
   Debug signing certificate SHA-1: (optional for now)
   ```
3. Click **"Register app"**
4. Download `google-services.json`
   - Place it in your Android project's `app/` directory
5. Follow the SDK installation instructions
6. Click **"Continue to console"**

### For iOS

1. Click **"Add app"** → **iOS icon**
2. Fill in the registration form:
   ```
   Bundle ID: com.proconnect.app
   App nickname: ProConnect iOS (optional)
   App Store ID: (optional)
   ```
3. Click **"Register app"**
4. Download `GoogleService-Info.plist`
   - Add it to your Xcode project
5. Follow the SDK installation instructions
6. Click **"Continue to console"**

### For Web (Optional)

1. Click **"Add app"** → **Web icon (</>)**
2. Enter app nickname: `ProConnect Web`
3. (Optional) Enable Firebase Hosting
4. Click **"Register app"**
5. Copy the Firebase configuration object
6. Click **"Continue to console"**

---

## Step 3: Generate Service Account Key (for Backend)

1. In Firebase Console, click the **gear icon** → **"Project settings"**
2. Go to the **"Service accounts"** tab
3. Click **"Generate new private key"**
4. Click **"Generate key"** in the confirmation dialog
5. A JSON file will be downloaded - **KEEP THIS SECURE!**

The JSON file looks like:
```json
{
  "type": "service_account",
  "project_id": "proconnect-xxxxx",
  "private_key_id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@proconnect-xxxxx.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

---

## Step 4: Configure Environment Variables

Add these to your `.env` file:

```env
# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=proconnect-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@proconnect-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**Important**: The private key must have `\n` characters preserved. In your `.env` file, wrap the entire key in double quotes.

### Alternative: Using JSON File Path

```env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
```

---

## Step 5: Enable Cloud Messaging API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **"APIs & Services"** → **"Library"**
4. Search for **"Firebase Cloud Messaging API"**
5. Click **"Enable"**

Also enable:
- **Firebase Installations API**
- **FCM Registration API**

---

## Step 6: Configure APNs for iOS (Required)

### Generate APNs Authentication Key

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **"Certificates, Identifiers & Profiles"** → **"Keys"**
3. Click **"+"** to create a new key
4. Enter a name: `ProConnect APNs Key`
5. Check **"Apple Push Notifications service (APNs)"**
6. Click **"Continue"** then **"Register"**
7. Download the `.p8` key file
8. Note the **Key ID**

### Upload to Firebase

1. In Firebase Console, go to **Project settings** → **"Cloud Messaging"** tab
2. Under **"Apple app configuration"**, find your iOS app
3. Click **"Upload"** next to **"APNs Authentication Key"**
4. Upload your `.p8` file
5. Enter the **Key ID**
6. Enter your **Team ID**
7. Click **"Upload"**

---

## Implementation

### Backend (Node.js/TypeScript)

```typescript
// src/services/notificationService.ts
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
export function initializeFCM(): void {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
}

// Send notification to a single device
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<string> {
  const message: admin.messaging.Message = {
    notification: {
      title,
      body,
    },
    data,
    token,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        clickAction: 'OPEN_ACTIVITY',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  return admin.messaging().send(message);
}

// Send notification to multiple devices
export async function sendMulticastNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<admin.messaging.BatchResponse> {
  const message: admin.messaging.MulticastMessage = {
    notification: {
      title,
      body,
    },
    data,
    tokens,
  };

  return admin.messaging().sendEachForMulticast(message);
}

// Subscribe token to topic
export async function subscribeToTopic(
  tokens: string[],
  topic: string
): Promise<admin.messaging.MessagingTopicManagementResponse> {
  return admin.messaging().subscribeToTopic(tokens, topic);
}

// Send notification to topic
export async function sendToTopic(
  topic: string,
  title: string,
  body: string
): Promise<string> {
  return admin.messaging().send({
    notification: { title, body },
    topic,
  });
}
```

### Mobile Apps

#### Android (Kotlin)

```kotlin
// Get FCM Token
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    if (!task.isSuccessful) {
        Log.w(TAG, "Fetching FCM registration token failed", task.exception)
        return@addOnCompleteListener
    }
    val token = task.result
    // Send token to your backend
    sendTokenToServer(token)
}

// Handle incoming messages
class MyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        remoteMessage.notification?.let {
            showNotification(it.title, it.body)
        }
    }
    
    override fun onNewToken(token: String) {
        // Send new token to your backend
        sendTokenToServer(token)
    }
}
```

#### iOS (Swift)

```swift
import Firebase
import UserNotifications

// Request notification permission
UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
    if granted {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
}

// Get FCM Token
Messaging.messaging().token { token, error in
    if let error = error {
        print("Error fetching FCM token: \(error)")
    } else if let token = token {
        print("FCM token: \(token)")
        // Send token to your backend
        sendTokenToServer(token)
    }
}

// Handle token refresh
func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    if let token = fcmToken {
        sendTokenToServer(token)
    }
}
```

#### React Native

```typescript
import messaging from '@react-native-firebase/messaging';

// Request permission (iOS)
async function requestPermission() {
  const authStatus = await messaging().requestPermission();
  return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
         authStatus === messaging.AuthorizationStatus.PROVISIONAL;
}

// Get FCM token
async function getFCMToken() {
  const token = await messaging().getToken();
  console.log('FCM Token:', token);
  // Send to your backend
  await api.post('/users/fcm-token', { fcmToken: token });
  return token;
}

// Listen for token refresh
messaging().onTokenRefresh(async token => {
  await api.post('/users/fcm-token', { fcmToken: token });
});

// Handle foreground messages
messaging().onMessage(async remoteMessage => {
  console.log('Foreground message:', remoteMessage);
  // Show local notification or update UI
});

// Handle background/quit messages
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background message:', remoteMessage);
});
```

---

## Notification Types

### Data Messages

```typescript
// Handled by your app in foreground and background
const message = {
  data: {
    type: 'NEW_MESSAGE',
    conversationId: '123',
    senderId: '456',
  },
  token: fcmToken,
};
```

### Notification Messages

```typescript
// System tray notification, handled by OS when app is in background
const message = {
  notification: {
    title: 'New Message',
    body: 'John: Hey, how are you?',
  },
  token: fcmToken,
};
```

### Combined (Recommended)

```typescript
// Both notification display and data handling
const message = {
  notification: {
    title: 'New Message',
    body: 'John: Hey, how are you?',
  },
  data: {
    type: 'NEW_MESSAGE',
    conversationId: '123',
    click_action: 'OPEN_CHAT',
  },
  token: fcmToken,
};
```

---

## Troubleshooting

### Common Issues

1. **"Requested entity was not found"**
   - Token has expired or been invalidated
   - Remove the token from your database

2. **"Invalid registration token"**
   - Token format is wrong
   - Token belongs to a different Firebase project

3. **iOS notifications not received**
   - APNs key not configured
   - App not signed with proper provisioning profile
   - User declined notification permission

4. **Android notifications not showing**
   - Notification channel not created (Android 8+)
   - App is in battery optimization mode
   - Check device notification settings

### Debug Logging

```typescript
// Enable debug logging
admin.messaging().send(message, true) // dryRun = true for testing
```

---

## Best Practices

1. **Handle Token Refresh**
   - Always update token on your server when it changes
   - Remove invalid tokens from database

2. **Use Topics for Broadcast**
   - More efficient than sending to individual tokens
   - Good for announcements, promotions

3. **Respect User Preferences**
   - Allow users to control notification types
   - Don't send too many notifications

4. **Handle Failures Gracefully**
   - Implement retry logic with exponential backoff
   - Remove invalid tokens from database

5. **Use Data Messages for Critical Updates**
   - More reliable delivery
   - Full control over display

---

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [FCM Server Reference](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages)
- [APNs Documentation](https://developer.apple.com/documentation/usernotifications)
- [firebase-admin-node](https://www.npmjs.com/package/firebase-admin)
