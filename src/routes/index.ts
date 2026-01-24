// ===========================================
// PROCONNECT - ROUTES INDEX
// Export all routes
// ===========================================

import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import chatRoutes from './chatRoutes';
import groupRoutes from './groupRoutes';
import callRoutes from './callRoutes';
import mediaRoutes from './mediaRoutes';

const router = Router();

// API Version 1 Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/chat', chatRoutes);
router.use('/groups', groupRoutes);
router.use('/calls', callRoutes);
router.use('/media', mediaRoutes);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ProConnect API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

export default router;
