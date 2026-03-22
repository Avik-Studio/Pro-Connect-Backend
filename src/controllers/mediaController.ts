// ===========================================
// PROCONNECT - MEDIA CONTROLLER
// File upload and media API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { mediaService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';
import { BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';

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
    logger.debug('[MEDIA] POST /upload');
    logger.debug(`User ID: ${req.userId}`);

    const file = req.file;
    if (!file) {
      logger.debug('No file provided in request');
      throw new BadRequestError('No file provided');
    }

    logger.debug(`File info: ${JSON.stringify({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: `${(file.size / 1024).toFixed(2)} KB`,
    })}`);

    const media = await mediaService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    logger.debug('File uploaded successfully');
    logger.debug(`URL: ${media.url}`);

    sendCreated(res, 'File uploaded successfully', { media });
  } catch (error) {
    logger.error(`[MEDIA] Upload file error: ${(error as Error).message}`);
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
    logger.debug('[MEDIA] POST /signed-url');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Request: ${JSON.stringify({
      fileName: req.body.fileName,
      mimeType: req.body.mimeType,
      fileSize: `${(req.body.fileSize / 1024).toFixed(2)} KB`,
    })}`);

    const { fileName, mimeType, fileSize } = req.body;
    const { uploadUrl, publicId } = await mediaService.getSignedUploadUrl(
      fileName,
      mimeType,
      fileSize
    );

    logger.debug('Signed URL generated');
    logger.debug(`Public ID: ${publicId}`);

    sendSuccess(res, 'Signed URL generated', { uploadUrl, publicId });
  } catch (error) {
    logger.error(`[MEDIA] Get signed URL error: ${(error as Error).message}`);
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
    logger.debug('[MEDIA] DELETE /:publicId');
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Public ID: ${req.params.publicId}`);

    const { publicId } = req.params;
    await mediaService.deleteFile(decodeURIComponent(publicId));

    logger.debug('File deleted successfully');

    sendSuccess(res, 'File deleted successfully');
  } catch (error) {
    logger.error(`[MEDIA] Delete file error: ${(error as Error).message}`);
    next(error);
  }
};

export default {
  uploadFile,
  getSignedUploadUrl,
  deleteFile,
};
