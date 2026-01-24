# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth 2.0 credentials for ProConnect.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter a project name (e.g., "ProConnect")
5. Click **"Create"**
6. Wait for the project to be created and select it

---

## Step 2: Enable Required APIs

1. In the left sidebar, navigate to **"APIs & Services"** → **"Library"**
2. Search for and enable the following APIs:
   - **Google+ API** (for basic profile info)
   - **Google Identity Platform** (optional, for advanced features)

---

## Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose User Type:
   - **External** (for public apps)
   - **Internal** (for Google Workspace organizations)
3. Click **"Create"**

4. Fill in the App Information:
   ```
   App name: ProConnect
   User support email: your-email@example.com
   Developer contact email: your-email@example.com
   ```

5. Click **"Save and Continue"**

6. **Scopes** - Add the following scopes:
   - `email` - View user's email address
   - `profile` - View user's basic profile info
   - `openid` - Associate you with your personal info

7. Click **"Save and Continue"**

8. **Test users** (if External):
   - Add email addresses of test users during development
   - In production, you'll need to publish the app

9. Click **"Save and Continue"**

---

## Step 4: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Select **Application type**: **Web application**
4. Enter a name: `ProConnect Web Client`

5. Configure **Authorized JavaScript origins**:
   ```
   # Development
   http://localhost:3000
   http://localhost:5000
   
   # Production (add your domains)
   https://your-frontend-domain.com
   https://your-api-domain.com
   ```

6. Configure **Authorized redirect URIs**:
   ```
   # Development
   http://localhost:5000/api/v1/auth/google/callback
   http://localhost:3000/auth/callback
   
   # Production (add your domains)
   https://your-api-domain.com/api/v1/auth/google/callback
   https://your-frontend-domain.com/auth/callback
   ```

7. Click **"Create"**

8. Copy the credentials:
   - **Client ID**: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 5: Configure Environment Variables

Add these to your `.env` file:

```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Step 6: For Mobile Apps (Optional)

### Android

1. In Credentials page, click **"Create Credentials"** → **"OAuth client ID"**
2. Select **Application type**: **Android**
3. Enter your package name (e.g., `com.proconnect.app`)
4. Enter SHA-1 fingerprint:
   ```bash
   # Debug keystore
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   
   # Release keystore
   keytool -list -v -keystore your-release-key.keystore -alias your-alias
   ```
5. Click **"Create"**

### iOS

1. In Credentials page, click **"Create Credentials"** → **"OAuth client ID"**
2. Select **Application type**: **iOS**
3. Enter your Bundle ID (e.g., `com.proconnect.app`)
4. Enter App Store ID (optional)
5. Enter Team ID (optional)
6. Click **"Create"**

---

## Step 7: Publish Your App (Production)

When ready for production:

1. Go to **"OAuth consent screen"**
2. Click **"Publish App"**
3. Complete the verification process if required:
   - For sensitive scopes: Domain verification required
   - For restricted scopes: Security assessment required

---

## Implementation Example

### Backend (Express + Passport.js)

```typescript
// src/config/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: '/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create user
        const user = await findOrCreateUser({
          googleId: profile.id,
          email: profile.emails?.[0]?.value,
          displayName: profile.displayName,
          avatar: profile.photos?.[0]?.value,
        });
        done(null, user);
      } catch (error) {
        done(error, undefined);
      }
    }
  )
);
```

### Frontend (React)

```typescript
// OAuth login button
const handleGoogleLogin = () => {
  window.location.href = `${API_URL}/api/v1/auth/google`;
};

// Or use @react-oauth/google
import { GoogleLogin } from '@react-oauth/google';

<GoogleLogin
  onSuccess={credentialResponse => {
    // Send credential to your backend
    fetch('/api/v1/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ credential: credentialResponse.credential })
    });
  }}
  onError={() => console.log('Login Failed')}
/>
```

---

## Troubleshooting

### Common Errors

1. **"redirect_uri_mismatch"**
   - Ensure the redirect URI in your code exactly matches what's in Google Console
   - Check for trailing slashes
   - Verify protocol (http vs https)

2. **"invalid_client"**
   - Verify Client ID and Secret are correct
   - Check for extra spaces or newlines in env vars

3. **"access_denied"**
   - User declined permissions
   - App not verified (in production)
   - User not in test users list (during development)

4. **"unauthorized_client"**
   - OAuth client not enabled for this project
   - Wrong client type for your use case

### Debug Mode

Add this to see detailed OAuth logs:
```env
DEBUG=passport:*
```

---

## Security Considerations

1. **Never expose Client Secret in frontend code**
2. **Use HTTPS in production**
3. **Validate OAuth state parameter to prevent CSRF**
4. **Store tokens securely**
5. **Implement token refresh flow**
6. **Set appropriate token expiration times**

---

## Additional Resources

- [Google Identity Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Passport.js Google Strategy](http://www.passportjs.org/packages/passport-google-oauth20/)
