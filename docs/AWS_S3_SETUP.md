# AWS S3 Setup Guide

This guide walks you through setting up AWS S3 for media storage in ProConnect (alternative to Cloudinary).

## Prerequisites

- An AWS account
- Access to [AWS Console](https://console.aws.amazon.com/)

---

## Step 1: Create an S3 Bucket

1. Go to [S3 Console](https://s3.console.aws.amazon.com/s3/)
2. Click **"Create bucket"**
3. Configure bucket:
   ```
   Bucket name: proconnect-media-bucket (must be globally unique)
   AWS Region: Select region closest to your users
   ```

4. **Object Ownership**:
   - Select **"ACLs disabled (recommended)"**

5. **Block Public Access settings**:
   - Uncheck **"Block all public access"** (if you need public media)
   - Check the acknowledgment
   
   Or keep all blocked for private media with signed URLs

6. **Bucket Versioning**: Disable (unless you need file versioning)

7. **Default encryption**: 
   - Enable **"Server-side encryption"**
   - Use **"Amazon S3-managed keys (SSE-S3)"**

8. Click **"Create bucket"**

---

## Step 2: Configure CORS

1. Click on your bucket name
2. Go to **"Permissions"** tab
3. Scroll to **"Cross-origin resource sharing (CORS)"**
4. Click **"Edit"** and add:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "http://localhost:5000",
            "https://your-frontend-domain.com"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-meta-custom-header"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

5. Click **"Save changes"**

---

## Step 3: Create Bucket Policy (for public access)

If you want public read access to uploaded files:

1. Go to **"Permissions"** → **"Bucket policy"**
2. Add this policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::proconnect-media-bucket/*"
        }
    ]
}
```

---

## Step 4: Create IAM User for Backend

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click **"Users"** → **"Add users"**
3. Configure:
   ```
   User name: proconnect-backend
   Access type: Check "Programmatic access"
   ```

4. Click **"Next: Permissions"**

5. Click **"Attach existing policies directly"**
6. Click **"Create policy"** (opens new tab)

7. Create a custom policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::proconnect-media-bucket",
                "arn:aws:s3:::proconnect-media-bucket/*"
            ]
        }
    ]
}
```

8. Name it: `ProConnectS3Policy`
9. Create policy and go back to user creation

10. Search and attach `ProConnectS3Policy`
11. Click through to create user
12. **IMPORTANT**: Save the **Access key ID** and **Secret access key**

---

## Step 5: Configure Environment Variables

Add these to your `.env` file:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_S3_BUCKET=proconnect-media-bucket
```

---

## Implementation

### Backend (Node.js/TypeScript)

```typescript
// src/config/aws.ts
import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET!;
```

```typescript
// src/services/s3Service.ts
import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET } from '../config/aws';
import { v4 as uuidv4 } from 'uuid';

interface UploadResult {
  url: string;
  key: string;
  mimeType: string;
  size: number;
}

// Upload file from buffer
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const folder = getFolderForType(mimeType);
  const key = `${folder}/${uuidv4()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    // For public access:
    // ACL: 'public-read',
  });

  await s3Client.send(command);

  return {
    url: `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    key,
    mimeType,
    size: buffer.length,
  };
}

// Generate pre-signed URL for client upload
export async function getSignedUploadUrl(
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<{ uploadUrl: string; key: string }> {
  const folder = getFolderForType(mimeType);
  const key = `${folder}/${uuidv4()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });

  return { uploadUrl, key };
}

// Generate pre-signed URL for private file access
export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });
}

// Delete file
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

// Helper function
function getFolderForType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'files';
}
```

### Frontend (Direct Upload with Pre-signed URL)

```typescript
// Get pre-signed URL from backend
async function getUploadUrl(file: File) {
  const response = await fetch('/api/v1/media/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    }),
  });
  return response.json();
}

// Upload directly to S3
async function uploadToS3(file: File): Promise<string> {
  const { uploadUrl, key } = await getUploadUrl(file);

  await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  // Return the public URL or key
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

// Usage
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    const url = await uploadToS3(file);
    console.log('Uploaded:', url);
  }
};
```

---

## CloudFront CDN (Recommended for Production)

### Step 1: Create CloudFront Distribution

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click **"Create distribution"**
3. Configure:
   ```
   Origin domain: proconnect-media-bucket.s3.amazonaws.com
   Origin path: (leave empty)
   S3 bucket access: Yes use OAI
   Create new OAI: Yes
   Bucket policy: Yes, update the bucket policy
   ```

4. **Default cache behavior**:
   - Viewer protocol policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP methods: **GET, HEAD**
   - Cache policy: **CachingOptimized**

5. **Settings**:
   - Price class: Select based on your audience
   - Alternate domain name: `cdn.your-domain.com` (optional)
   - SSL certificate: Select or request certificate

6. Click **"Create distribution"**

### Step 2: Update File URLs

```typescript
// Use CloudFront URL instead of S3 URL
const CLOUDFRONT_URL = 'https://d1234567890.cloudfront.net';

function getFileUrl(key: string): string {
  return `${CLOUDFRONT_URL}/${key}`;
}
```

---

## Lambda for Image Processing (Optional)

### Create Lambda Function

```javascript
// Lambda function for image resizing
const AWS = require('aws-sdk');
const sharp = require('sharp');

const s3 = new AWS.S3();

exports.handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key);
  
  // Skip if already processed
  if (key.includes('thumbnails/')) return;
  
  const image = await s3.getObject({ Bucket: bucket, Key: key }).promise();
  
  // Generate thumbnail
  const thumbnail = await sharp(image.Body)
    .resize(200, 200, { fit: 'cover' })
    .toBuffer();
  
  await s3.putObject({
    Bucket: bucket,
    Key: `thumbnails/${key}`,
    Body: thumbnail,
    ContentType: 'image/jpeg',
  }).promise();
};
```

### Configure S3 Event Trigger

1. Go to your Lambda function
2. Add trigger → S3
3. Configure:
   - Bucket: `proconnect-media-bucket`
   - Event type: `s3:ObjectCreated:*`
   - Prefix: `images/`

---

## Pricing

### S3 Standard (us-east-1)

| Feature | Price |
|---------|-------|
| Storage | $0.023 per GB/month |
| PUT, COPY, POST | $0.005 per 1,000 requests |
| GET, SELECT | $0.0004 per 1,000 requests |
| Data Transfer OUT | First 100GB free, then $0.09/GB |

### Free Tier (12 months)

- 5GB storage
- 20,000 GET requests
- 2,000 PUT requests

---

## Troubleshooting

### Common Issues

1. **"Access Denied"**
   - Check IAM permissions
   - Verify bucket policy
   - Check CORS configuration

2. **"SignatureDoesNotMatch"**
   - Verify credentials
   - Check region matches bucket location
   - Ensure clock is synchronized

3. **Pre-signed URL expired**
   - Increase `expiresIn` value
   - Generate URL closer to upload time

4. **CORS errors**
   - Verify allowed origins in CORS config
   - Check Content-Type header in request

---

## Security Best Practices

1. **Use IAM roles instead of access keys when possible**
2. **Enable bucket versioning for important data**
3. **Enable S3 access logging**
4. **Use pre-signed URLs for private content**
5. **Enable server-side encryption**
6. **Implement lifecycle policies for old files**
7. **Use VPC endpoints for internal traffic**

---

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
