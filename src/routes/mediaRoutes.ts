// ===========================================
// PROCONNECT - MEDIA ROUTES
// File upload and media API endpoints with Swagger docs
// ===========================================

import { Router } from 'express';
import multer from 'multer';
import { mediaController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { uploadLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';
import { BadRequestError } from '../utils/errors';

const router = Router();

// ===========================================
// MULTER CONFIGURATION
// ===========================================

const storage = multer.memoryStorage();

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`File type ${file.mimetype} is not allowed`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1,
  },
});

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const signedUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  fileSize: z.number().positive('File size must be positive').max(100 * 1024 * 1024, 'File size exceeds 100MB limit'),
});

// ===========================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ===========================================

router.use(authenticate);

// ===========================================
// SWAGGER DOCUMENTATION & ROUTES
// ===========================================

/**
 * @swagger
 * /media/upload:
 *   post:
 *     summary: Upload a file
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (max 100MB)
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     media:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                           format: uri
 *                         publicId:
 *                           type: string
 *                         mimeType:
 *                           type: string
 *                         size:
 *                           type: integer
 *       400:
 *         description: No file provided or invalid file type
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post(
  '/upload',
  uploadLimiter,
  upload.single('file'),
  mediaController.uploadFile
);

/**
 * @swagger
 * /media/signed-url:
 *   post:
 *     summary: Get signed upload URL for direct client upload
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - mimeType
 *               - fileSize
 *             properties:
 *               fileName:
 *                 type: string
 *                 example: image.jpg
 *               mimeType:
 *                 type: string
 *                 example: image/jpeg
 *               fileSize:
 *                 type: integer
 *                 description: File size in bytes
 *                 maximum: 104857600
 *     responses:
 *       200:
 *         description: Signed URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploadUrl:
 *                       type: string
 *                       format: uri
 *                       description: Pre-signed URL for direct upload
 *                     publicId:
 *                       type: string
 *                       description: ID to reference the file after upload
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/signed-url',
  validateBody(signedUrlSchema),
  mediaController.getSignedUploadUrl
);

/**
 * @swagger
 * /media/{publicId}:
 *   delete:
 *     summary: Delete a file
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *         description: Public ID of the file to delete (URL encoded)
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:publicId', mediaController.deleteFile);

export default router;
