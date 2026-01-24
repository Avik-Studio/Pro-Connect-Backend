// ===========================================
// PROCONNECT - MEDIA SERVICE
// File upload and media handling
// ===========================================

import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appConfig } from '../config';
import { IMediaAttachment } from '../types';
import { FileUploadError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { getFileExtension, getMimeCategory } from '../utils/helpers';

// Initialize Cloudinary
cloudinary.config({
  cloud_name: appConfig.cloudinary.cloudName,
  api_key: appConfig.cloudinary.apiKey,
  api_secret: appConfig.cloudinary.apiSecret,
});

// Initialize S3 Client
const s3Client = new S3Client({
  region: appConfig.aws.region,
  credentials: {
    accessKeyId: appConfig.aws.accessKeyId || '',
    secretAccessKey: appConfig.aws.secretAccessKey || '',
  },
});

// File type configurations
const FILE_CONFIGS: Record<string, { maxSize: number; folder: string }> = {
  image: { maxSize: 10 * 1024 * 1024, folder: 'images' }, // 10MB
  video: { maxSize: 100 * 1024 * 1024, folder: 'videos' }, // 100MB
  audio: { maxSize: 25 * 1024 * 1024, folder: 'audio' }, // 25MB
  document: { maxSize: 25 * 1024 * 1024, folder: 'documents' }, // 25MB
};

/**
 * Validate file before upload
 */
const validateFile = (
  fileName: string,
  fileSize: number,
  mimeType: string
): void => {
  // Check if file type is allowed
  if (!appConfig.upload.allowedFileTypes.includes(mimeType)) {
    throw new BadRequestError(`File type ${mimeType} is not allowed`);
  }

  // Get category and config
  const category = getMimeCategory(mimeType);
  const config = FILE_CONFIGS[category] || FILE_CONFIGS.document;

  // Check file size
  if (fileSize > config.maxSize) {
    const maxSizeMB = config.maxSize / (1024 * 1024);
    throw new BadRequestError(`File size exceeds maximum allowed (${maxSizeMB}MB)`);
  }
};

/**
 * Generate unique filename
 */
const generateFileName = (originalName: string): string => {
  const extension = getFileExtension(originalName);
  return `${uuidv4()}.${extension}`;
};

// ===========================================
// CLOUDINARY METHODS
// ===========================================

/**
 * Upload file to Cloudinary
 */
export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<IMediaAttachment> => {
  try {
    const category = getMimeCategory(mimeType);
    const config = FILE_CONFIGS[category] || FILE_CONFIGS.document;

    // Upload options
    const uploadOptions: Record<string, any> = {
      folder: `proconnect/${config.folder}`,
      public_id: generateFileName(fileName).split('.')[0],
      resource_type: category === 'video' ? 'video' : category === 'audio' ? 'video' : 'auto',
    };

    // Add transformations for images
    if (category === 'image') {
      uploadOptions.transformation = [
        { width: 1920, height: 1920, crop: 'limit' },
        { quality: 'auto:good' },
      ];
    }

    // Upload to Cloudinary
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result!);
        }
      );
      uploadStream.end(fileBuffer);
    });

    logger.info({ publicId: result.public_id, url: result.secure_url }, 'File uploaded to Cloudinary');

    return {
      url: result.secure_url,
      publicId: result.public_id,
      fileName,
      fileSize: result.bytes,
      mimeType,
      duration: result.duration,
      dimensions: result.width && result.height ? {
        width: result.width,
        height: result.height,
      } : undefined,
      thumbnail: result.thumbnail_url,
    };
  } catch (error) {
    logger.error({ error }, 'Cloudinary upload failed');
    throw new FileUploadError('Failed to upload file');
  }
};

/**
 * Delete file from Cloudinary
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
    logger.info({ publicId }, 'File deleted from Cloudinary');
  } catch (error) {
    logger.error({ error, publicId }, 'Cloudinary delete failed');
    throw new FileUploadError('Failed to delete file');
  }
};

/**
 * Generate Cloudinary signed upload URL
 */
export const getCloudinarySignedUpload = async (
  fileName: string,
  mimeType: string
): Promise<{ uploadUrl: string; publicId: string }> => {
  const category = getMimeCategory(mimeType);
  const config = FILE_CONFIGS[category] || FILE_CONFIGS.document;
  const publicId = `proconnect/${config.folder}/${generateFileName(fileName).split('.')[0]}`;

  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, public_id: publicId, folder: `proconnect/${config.folder}` },
    appConfig.cloudinary.apiSecret!
  );

  const uploadUrl = `https://api.cloudinary.com/v1_1/${appConfig.cloudinary.cloudName}/auto/upload`;

  return { uploadUrl, publicId };
};

// ===========================================
// AWS S3 METHODS
// ===========================================

/**
 * Upload file to S3
 */
export const uploadToS3 = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<IMediaAttachment> => {
  try {
    const category = getMimeCategory(mimeType);
    const config = FILE_CONFIGS[category] || FILE_CONFIGS.document;
    const key = `${config.folder}/${generateFileName(fileName)}`;

    const command = new PutObjectCommand({
      Bucket: appConfig.aws.s3Bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: 'private',
    });

    await s3Client.send(command);

    // Generate signed URL for access
    const getCommand = new GetObjectCommand({
      Bucket: appConfig.aws.s3Bucket,
      Key: key,
    });
    const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 * 24 * 7 }); // 7 days

    logger.info({ key }, 'File uploaded to S3');

    return {
      url,
      publicId: key,
      fileName,
      fileSize: fileBuffer.length,
      mimeType,
    };
  } catch (error) {
    logger.error({ error }, 'S3 upload failed');
    throw new FileUploadError('Failed to upload file');
  }
};

/**
 * Delete file from S3
 */
export const deleteFromS3 = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: appConfig.aws.s3Bucket,
      Key: key,
    });

    await s3Client.send(command);
    logger.info({ key }, 'File deleted from S3');
  } catch (error) {
    logger.error({ error, key }, 'S3 delete failed');
    throw new FileUploadError('Failed to delete file');
  }
};

/**
 * Generate S3 presigned upload URL
 */
export const getS3SignedUploadUrl = async (
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<{ uploadUrl: string; key: string }> => {
  validateFile(fileName, fileSize, mimeType);

  const category = getMimeCategory(mimeType);
  const config = FILE_CONFIGS[category] || FILE_CONFIGS.document;
  const key = `${config.folder}/${generateFileName(fileName)}`;

  const command = new PutObjectCommand({
    Bucket: appConfig.aws.s3Bucket,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

  return { uploadUrl, key };
};

/**
 * Get S3 signed download URL
 */
export const getS3SignedDownloadUrl = async (key: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: appConfig.aws.s3Bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 * 24 }); // 24 hours
};

// ===========================================
// GENERAL METHODS
// ===========================================

/**
 * Upload file (uses Cloudinary by default, falls back to S3)
 */
export const uploadFile = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<IMediaAttachment> => {
  validateFile(fileName, fileBuffer.length, mimeType);

  // Use Cloudinary if configured, otherwise S3
  if (appConfig.cloudinary.cloudName && appConfig.cloudinary.apiKey) {
    return uploadToCloudinary(fileBuffer, fileName, mimeType);
  } else if (appConfig.aws.s3Bucket) {
    return uploadToS3(fileBuffer, fileName, mimeType);
  }

  throw new FileUploadError('No storage provider configured');
};

/**
 * Delete file
 */
export const deleteFile = async (publicId: string): Promise<void> => {
  if (publicId.startsWith('proconnect/')) {
    // Cloudinary file
    await deleteFromCloudinary(publicId);
  } else {
    // S3 file
    await deleteFromS3(publicId);
  }
};

/**
 * Get signed upload URL
 */
export const getSignedUploadUrl = async (
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<{ uploadUrl: string; publicId: string }> => {
  validateFile(fileName, fileSize, mimeType);

  if (appConfig.cloudinary.cloudName && appConfig.cloudinary.apiKey) {
    return getCloudinarySignedUpload(fileName, mimeType);
  } else if (appConfig.aws.s3Bucket) {
    const result = await getS3SignedUploadUrl(fileName, mimeType, fileSize);
    return { uploadUrl: result.uploadUrl, publicId: result.key };
  }

  throw new FileUploadError('No storage provider configured');
};

export default {
  uploadFile,
  deleteFile,
  getSignedUploadUrl,
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadToS3,
  deleteFromS3,
  getS3SignedUploadUrl,
  getS3SignedDownloadUrl,
};
