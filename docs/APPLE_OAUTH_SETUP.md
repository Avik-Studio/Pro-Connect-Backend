# Apple OAuth Setup Guide

This guide walks you through setting up Apple Sign In for ProConnect.

## Prerequisites

- Apple Developer Account ($99/year)
- Access to [Apple Developer Portal](https://developer.apple.com/)

---

## Step 1: Create an App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **"Certificates, Identifiers & Profiles"**
3. Click **"Identifiers"** in the sidebar
4. Click the **"+"** button to create a new identifier
5. Select **"App IDs"** and click **"Continue"**
6. Select **"App"** and click **"Continue"**

7. Fill in the details:
   ```
   Description: ProConnect
   Bundle ID: com.proconnect.app (Explicit)
   ```

8. In **Capabilities**, check **"Sign In with Apple"**
9. Click **"Continue"** then **"Register"**

---

## Step 2: Create a Services ID (for Web)

1. In **"Identifiers"**, click **"+"**
2. Select **"Services IDs"** and click **"Continue"**
3. Fill in:
   ```
   Description: ProConnect Web
   Identifier: com.proconnect.web (this will be your Client ID)
   ```
4. Click **"Continue"** then **"Register"**

5. Click on the newly created Services ID
6. Check **"Sign In with Apple"**
7. Click **"Configure"** next to Sign In with Apple

8. Configure the Web Authentication:
   ```
   Primary App ID: Select your App ID (com.proconnect.app)
   
   Domains and Subdomains:
   - localhost (for development)
   - your-api-domain.com (for production)
   
   Return URLs:
   - http://localhost:5000/api/v1/auth/apple/callback
   - https://your-api-domain.com/api/v1/auth/apple/callback
   ```

9. Click **"Save"** then **"Continue"** then **"Save"**

---

## Step 3: Create a Key for Sign In with Apple

1. Go to **"Keys"** in the sidebar
2. Click **"+"** to create a new key
3. Fill in:
   ```
   Key Name: ProConnect Sign In Key
   ```
4. Check **"Sign In with Apple"**
5. Click **"Configure"** next to Sign In with Apple
6. Select your Primary App ID and click **"Save"**
7. Click **"Continue"** then **"Register"**

8. **IMPORTANT**: Download the key file (.p8)
   - You can only download this ONCE
   - Store it securely
   - Note the **Key ID** shown

9. Click **"Done"**

---

## Step 4: Note Your Team ID

1. In the top right, click on your account name
2. Your **Team ID** is shown (a 10-character code like `ABC123DEF4`)

---

## Step 5: Configure Environment Variables

Add these to your `.env` file:

```env
# Apple OAuth Configuration
APPLE_CLIENT_ID=com.proconnect.web
APPLE_TEAM_ID=ABC123DEF4
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
...your-key-content-here...
-----END PRIVATE KEY-----"
```

**Note**: For the private key, you can either:
1. Include the full key in the env var (with `\n` for newlines)
2. Or reference a file path: `APPLE_PRIVATE_KEY_PATH=./keys/AuthKey_XXXXXXXXXX.p8`

---

## Step 6: Generate Client Secret (JWT)

Apple requires a JWT client secret that you generate yourself. Here's how:

### Using Node.js Script

Create `scripts/generate-apple-secret.js`:

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('./path/to/AuthKey_XXXXXXXXXX.p8');
const teamId = process.env.APPLE_TEAM_ID;
const clientId = process.env.APPLE_CLIENT_ID;
const keyId = process.env.APPLE_KEY_ID;

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d', // Max 6 months
  audience: 'https://appleid.apple.com',
  issuer: teamId,
  subject: clientId,
  keyid: keyId,
});

console.log('Apple Client Secret (valid for 180 days):');
console.log(token);
```

Run:
```bash
node scripts/generate-apple-secret.js
```

### In Your Application

```typescript
// src/utils/appleAuth.ts
import jwt from 'jsonwebtoken';

export function generateAppleClientSecret(): string {
  const privateKey = process.env.APPLE_PRIVATE_KEY!;
  const teamId = process.env.APPLE_TEAM_ID!;
  const clientId = process.env.APPLE_CLIENT_ID!;
  const keyId = process.env.APPLE_KEY_ID!;

  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    audience: 'https://appleid.apple.com',
    issuer: teamId,
    subject: clientId,
    keyid: keyId,
  });
}
```

---

## Implementation Example

### Backend (Express)

```typescript
// src/config/passport.ts
import passport from 'passport';
import AppleStrategy from 'passport-apple';

passport.use(
  new AppleStrategy(
    {
      clientID: process.env.APPLE_CLIENT_ID!,
      teamID: process.env.APPLE_TEAM_ID!,
      keyID: process.env.APPLE_KEY_ID!,
      privateKeyString: process.env.APPLE_PRIVATE_KEY!,
      callbackURL: '/api/v1/auth/apple/callback',
      scope: ['name', 'email'],
    },
    async (accessToken, refreshToken, idToken, profile, done) => {
      try {
        // Note: Apple only sends name and email on FIRST sign in
        const user = await findOrCreateUser({
          appleId: profile.id,
          email: profile.email,
          displayName: profile.name?.firstName 
            ? `${profile.name.firstName} ${profile.name.lastName || ''}`
            : undefined,
        });
        done(null, user);
      } catch (error) {
        done(error, undefined);
      }
    }
  )
);
```

### Frontend (React Native)

```typescript
import { appleAuth } from '@invertase/react-native-apple-authentication';

async function handleAppleLogin() {
  try {
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });

    const credentialState = await appleAuth.getCredentialStateForUser(
      appleAuthRequestResponse.user
    );

    if (credentialState === appleAuth.State.AUTHORIZED) {
      // Send to your backend
      const response = await fetch('/api/v1/auth/apple/callback', {
        method: 'POST',
        body: JSON.stringify({
          identityToken: appleAuthRequestResponse.identityToken,
          authorizationCode: appleAuthRequestResponse.authorizationCode,
          fullName: appleAuthRequestResponse.fullName,
          email: appleAuthRequestResponse.email,
        }),
      });
    }
  } catch (error) {
    console.error('Apple Sign In Error:', error);
  }
}
```

### Frontend (Web)

```html
<!-- Apple Sign In Button -->
<div 
  id="appleid-signin" 
  data-color="black" 
  data-border="true" 
  data-type="sign in"
></div>

<script type="text/javascript" src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"></script>

<script>
  AppleID.auth.init({
    clientId: 'com.proconnect.web',
    scope: 'name email',
    redirectURI: 'https://your-api-domain.com/api/v1/auth/apple/callback',
    state: 'random-state-string',
    usePopup: true
  });
</script>
```

---

## Important Notes

### Apple Only Sends User Info Once

⚠️ **Critical**: Apple only sends the user's name and email on their **first** sign-in. After that, you only receive the user identifier. Make sure to:

1. Store the user info immediately on first sign-in
2. Have a fallback mechanism if you miss the initial data
3. Allow users to update their name manually

### Handling POST Callback

Apple sends the callback as a POST request with form data:

```typescript
// Route handler for Apple callback
router.post('/auth/apple/callback', 
  express.urlencoded({ extended: true }),
  async (req, res) => {
    const { code, id_token, user, state } = req.body;
    
    // 'user' is only present on first sign-in
    // It's a JSON string: { name: { firstName, lastName }, email }
    const userData = user ? JSON.parse(user) : null;
    
    // Process authentication...
  }
);
```

---

## Troubleshooting

### Common Errors

1. **"invalid_client"**
   - Verify Services ID is correctly configured
   - Check that domains/return URLs match exactly
   - Ensure client secret is freshly generated

2. **"invalid_grant"**
   - Authorization code has expired (valid for 5 minutes)
   - Code has already been used

3. **No user data received**
   - Remember: Apple only sends name/email on first authorization
   - Clear Sign In with Apple from device settings and try again for testing

4. **"redirect_uri_mismatch"**
   - Return URL must exactly match what's configured in Apple Developer Portal
   - Protocol (http/https) must match

### Testing on Simulator/Device

For iOS testing:
1. User must have Apple ID with two-factor authentication enabled
2. Sign In with Apple must be enabled in device settings
3. For Simulator, use a real Apple ID

---

## Security Considerations

1. **Validate ID Token on Your Server**
```typescript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys'
});

async function verifyAppleToken(idToken: string) {
  const decoded = jwt.decode(idToken, { complete: true });
  const key = await client.getSigningKey(decoded.header.kid);
  
  return jwt.verify(idToken, key.getPublicKey(), {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: process.env.APPLE_CLIENT_ID
  });
}
```

2. **Regenerate Client Secret Before Expiry**
   - Apple client secrets expire after max 6 months
   - Set up automated renewal or calendar reminders

3. **Store Private Key Securely**
   - Never commit to version control
   - Use secrets management in production

---

## Additional Resources

- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Apple Authentication Services](https://developer.apple.com/documentation/authenticationservices)
- [Sign In with Apple REST API](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api)
- [passport-apple](https://www.npmjs.com/package/passport-apple)
