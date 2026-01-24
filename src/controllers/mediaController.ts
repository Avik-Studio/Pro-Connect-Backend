// ===========================================
// PROCONNECT - MEDIA CONTROLLER
// File upload and media API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { mediaService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';
import { BadRequestError } from '../utils/errors';

/**
 * Upload file
 * POST /api/v1/media/upload
 */
export const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n📤 [MEDIA] POST /upload');
    console.log('👤 User ID:', req.userId);

    const file = req.file;
    if (!file) {
      console.log('⚠️ No file provided in request');
      throw new BadRequestError('No file provided');
    }

    console.log('📁 File info:', {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: `${(file.size / 1024).toFixed(2)} KB`,
    });

    const media = await mediaService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    console.log('✅ File uploaded successfully');
    console.log('🔗 URL:', media.url);

    sendCreated(res, 'File uploaded successfully', { media });
  } catch (error) {
    console.error('❌ [MEDIA] Upload file error:', (error as Error).message);
    next(error);
  }
};

/**
 * Get signed upload URL
 * POST /api/v1/media/signed-url
 */
export const getSignedUploadUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n🔐 [MEDIA] POST /signed-url');
    console.log('👤 User ID:', req.userId);
    console.log('📥 Request:', {
      fileName: req.body.fileName,
      mimeType: req.body.mimeType,
      fileSize: `${(req.body.fileSize / 1024).toFixed(2)} KB`,
    });

    const { fileName, mimeType, fileSize } = req.body;
    const { uploadUrl, publicId } = await mediaService.getSignedUploadUrl(
      fileName,
      mimeType,
      fileSize
    );

    console.log('✅ Signed URL generated');
    console.log('🔑 Public ID:', publicId);

    sendSuccess(res, 'Signed URL generated', { uploadUrl, publicId });
  } catch (error) {
    console.error('❌ [MEDIA] Get signed URL error:', (error as Error).message);
    next(error);
  }
};

/**
 * Delete file
 * DELETE /api/v1/media/:publicId
 */
export const deleteFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('\n🗑️ [MEDIA] DELETE /:publicId');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Public ID:', req.params.publicId);

    const { publicId } = req.params;
    await mediaService.deleteFile(decodeURIComponent(publicId));

    console.log('✅ File deleted successfully');

    sendSuccess(res, 'File deleted successfully');
  } catch (error) {
    console.error('❌ [MEDIA] Delete file error:', (error as Error).message);
    next(error);
  }
};

export default {
  uploadFile,
  getSignedUploadUrl,
  deleteFile,
};
