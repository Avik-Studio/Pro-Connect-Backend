# Cloudinary Setup Guide

This guide walks you through setting up Cloudinary for media storage in ProConnect.

## Prerequisites

- A Cloudinary account (free tier available)

---

## Step 1: Create Cloudinary Account

1. Go to [Cloudinary](https://cloudinary.com/)
2. Click **"Sign up for free"**
3. Fill in the registration form
4. Verify your email address

---

## Step 2: Get Your Credentials

1. Log in to your [Cloudinary Dashboard](https://cloudinary.com/console)
2. On the Dashboard, you'll see your account details:
   - **Cloud Name**: `your-cloud-name`
   - **API Key**: `123456789012345`
   - **API Secret**: `aBcDeFgHiJkLmNoPqRsTuVwXyZ`

![Cloudinary Dashboard](https://res.cloudinary.com/demo/image/upload/getting-started/dashboard.png)

---

## Step 3: Configure Environment Variables

Add these to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

---

## Step 4: Configure Upload Settings (Recommended)

### Enable Unsigned Uploads (Optional - for direct client uploads)

1. Go to **Settings** → **Upload**
2. Scroll to **"Upload presets"**
3. Click **"Add upload preset"**
4. Configure:
   ```
   Preset name: proconnect_uploads
   Signing Mode: Unsigned (for client-side) or Signed (for server-side)
   Folder: proconnect/
   ```
5. Under **"Upload Manipulations"**:
   - Set max file size
   - Enable format optimization
6. Click **"Save"**

### Create Upload Presets for Different Media Types

#### Images Preset
```
Name: proconnect_images
Folder: proconnect/images
Format: auto
Quality: auto
Max file size: 10 MB
Allowed formats: jpg, png, gif, webp
```

#### Videos Preset
```
Name: proconnect_videos
Folder: proconnect/videos
Resource type: video
Format: auto
Quality: auto
Max file size: 100 MB
```

#### Audio Preset
```
Name: proconnect_audio
Folder: proconnect/audio
Resource type: video (Cloudinary uses video type for audio)
Format: auto
Max file size: 50 MB
```

---

## Step 5: Security Settings

### Restrict Media Library Access

1. Go to **Settings** → **Security**
2. Enable **"Strict transformations"** to prevent URL manipulation
3. Enable **"Sign transformations"** for authenticated transformations

### Configure CORS (for direct uploads)

1. Go to **Settings** → **Security**
2. Add your domains to **"Allowed fetch domains"**:
   ```
   localhost:3000
   localhost:5000
   your-frontend-domain.com
   ```

---

## Implementation

### Backend (Node.js/TypeScript)

```typescript
// src/config/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Use HTTPS
});

export default cloudinary;
```

```typescript
// src/services/mediaService.ts
import cloudinary from '../config/cloudinary';
import { BadRequestError } from '../utils/errors';

interface UploadResult {
  url: string;
  publicId: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}

// Upload file from buffer
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const resourceType = getResourceType(mimeType);
  const folder = getFolderForType(mimeType);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `proconnect/${folder}`,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        // Image transformations
        ...(resourceType === 'image' && {
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
        }),
      },
      (error, result) => {
        if (error) {
          reject(new BadRequestError(`Upload failed: ${error.message}`));
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            mimeType: mimeType,
            size: result.bytes,
            width: result.width,
            height: result.height,
            duration: result.duration,
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
}

// Generate signed upload URL for client-side uploads
export async function getSignedUploadUrl(
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<{ uploadUrl: string; publicId: string }> {
  const folder = getFolderForType(mimeType);
  const publicId = `proconnect/${folder}/${Date.now()}_${fileName}`;
  
  const timestamp = Math.round(Date.now() / 1000);
  
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder: `proconnect/${folder}`,
      public_id: publicId,
    },
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    publicId,
  };
}

// Delete file
export async function deleteFile(publicId: string): Promise<void> {
  const result = await cloudinary.uploader.destroy(publicId);
  if (result.result !== 'ok') {
    throw new BadRequestError('Failed to delete file');
  }
}

// Helper functions
function getResourceType(mimeType: string): 'image' | 'video' | 'raw' | 'auto' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return 'video';
  return 'raw';
}

function getFolderForType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'files';
}
```

### Frontend (Direct Upload - React)

```typescript
// Direct upload using unsigned preset
async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'proconnect_uploads');
  formData.append('cloud_name', 'your-cloud-name');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/your-cloud-name/auto/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = await response.json();
  return data.secure_url;
}

// Usage
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    const url = await uploadToCloudinary(file);
    console.log('Uploaded:', url);
  }
};
```

### React Native

```typescript
import { upload } from 'cloudinary-react-native';

const uploadOptions = {
  upload_preset: 'proconnect_uploads',
  unsigned: true,
};

async function uploadMedia(uri: string) {
  const result = await upload(uri, {
    cloudName: 'your-cloud-name',
    ...uploadOptions,
  });
  return result.secure_url;
}
```

---

## Image Transformations

### Generate Thumbnail URL

```typescript
function getThumbnailUrl(publicId: string, width = 200, height = 200): string {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    fetch_format: 'auto',
  });
}

// Example output:
// https://res.cloudinary.com/your-cloud/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/proconnect/images/abc123
```

### Generate Avatar URL

```typescript
function getAvatarUrl(publicId: string, size = 100): string {
  return cloudinary.url(publicId, {
    width: size,
    height: size,
    crop: 'fill',
    gravity: 'face',
    radius: 'max', // Circular
    quality: 'auto',
    fetch_format: 'auto',
  });
}
```

### Video Thumbnail

```typescript
function getVideoThumbnail(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    format: 'jpg',
    transformation: [
      { width: 400, height: 300, crop: 'fill' },
      { start_offset: '1' }, // 1 second into the video
    ],
  });
}
```

---

## Webhooks (Optional)

### Configure Notification URL

1. Go to **Settings** → **Upload**
2. Add **"Notification URL"**:
   ```
   https://your-api-domain.com/api/v1/webhooks/cloudinary
   ```

### Handle Webhooks

```typescript
// src/routes/webhooks.ts
router.post('/cloudinary', async (req, res) => {
  const { notification_type, public_id, secure_url, resource_type } = req.body;

  switch (notification_type) {
    case 'upload':
      console.log(`File uploaded: ${public_id}`);
      // Update database, send notification, etc.
      break;
    case 'delete':
      console.log(`File deleted: ${public_id}`);
      break;
  }

  res.status(200).json({ received: true });
});
```

---

## Pricing & Limits

### Free Tier (Programmable Media)

- **25 Credits/month** (1 Credit ≈ 1000 transformations or 1GB storage)
- **25GB Storage**
- **25GB Bandwidth/month**

### Estimating Usage

| Action | Credit Cost |
|--------|-------------|
| 1,000 transformations | 1 Credit |
| 1 GB managed storage | 1 Credit |
| 1 GB viewing bandwidth | 1 Credit |
| Video/audio per second | Variable |

---

## Troubleshooting

### Common Issues

1. **"Invalid API credentials"**
   - Verify Cloud Name, API Key, and API Secret
   - Check for extra spaces in env vars

2. **"Upload preset not found"**
   - Verify preset name exactly matches
   - Check if preset is enabled

3. **CORS errors on direct upload**
   - Add your domain to allowed origins in Cloudinary settings
   - Use signed uploads instead of unsigned

4. **Transformation not applied**
   - Check if strict transformations is enabled
   - Verify transformation syntax

### Debug Mode

```typescript
// Enable verbose logging
cloudinary.config({
  ...existingConfig,
  logger: true,
});
```

---

## Best Practices

1. **Use Upload Presets**
   - Define transformations server-side
   - Prevent malicious transformations

2. **Lazy Transformations**
   - Generate URLs with transformations
   - Cloudinary transforms on-demand

3. **Use Auto Format/Quality**
   - `f_auto` delivers optimal format
   - `q_auto` balances quality and size

4. **Organize with Folders**
   - Use meaningful folder structure
   - Makes cleanup and management easier

5. **Clean Up Unused Assets**
   - Set up deletion when content is removed
   - Use admin API for bulk operations

---

## Additional Resources

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Node.js SDK](https://cloudinary.com/documentation/node_integration)
- [Transformation Reference](https://cloudinary.com/documentation/transformation_reference)
- [Upload API Reference](https://cloudinary.com/documentation/image_upload_api_reference)
