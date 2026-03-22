// ===========================================
// PROCONNECT - AUTH CONTROLLER
// Authentication API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';
import { appConfig } from '../config';
import { logger } from '../utils/logger';

/**
 * Register new user
 * POST /api/v1/auth/register
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] POST /register - Registration attempt`);
    logger.debug(`Request body: ${JSON.stringify(req.body, null, 2)}`);

    const { email, password, username, displayName } = req.body;
    const deviceInfo = req.deviceInfo!;

    logger.debug(`Device info: ${deviceInfo}`);

    const { user, tokens } = await authService.register(
      email,
      password,
      username,
      displayName,
      deviceInfo
    );

    logger.debug(`Registration successful for user: ${user.email}`);
    logger.debug(`Tokens generated: ${JSON.stringify({
      accessToken: tokens.accessToken.substring(0, 20) + '...',
      refreshToken: tokens.refreshToken.substring(0, 20) + '...',
    })}`);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...appConfig.cookie.options,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', tokens.refreshToken, appConfig.cookie.options);

    sendCreated(res, 'Registration successful', {
      user,
      tokens,
    });
  } catch (error) {
    logger.error(`[AUTH] Registration error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Login user
 * POST /api/v1/auth/login
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] POST /login - Login attempt`);
    logger.debug(`Request body: ${JSON.stringify({ email: req.body.email, password: '***' })}`);

    const { email, password } = req.body;
    const deviceInfo = req.deviceInfo!;

    logger.debug(`Device info: ${deviceInfo}`);

    const { user, tokens } = await authService.login(email, password, deviceInfo);

    logger.debug(`Login successful for user: ${user.email}`);
    logger.debug(`Tokens generated: ${JSON.stringify({
      accessToken: tokens.accessToken.substring(0, 20) + '...',
      refreshToken: tokens.refreshToken.substring(0, 20) + '...',
    })}`);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...appConfig.cookie.options,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', tokens.refreshToken, appConfig.cookie.options);

    sendSuccess(res, 'Login successful', {
      user,
      tokens,
    });
  } catch (error) {
    logger.error(`[AUTH] Login error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] POST /refresh - Token refresh attempt`);

    const refreshTokenValue = req.cookies?.refreshToken || req.body?.refreshToken;
    const deviceInfo = req.deviceInfo!;

    logger.debug(`Refresh token provided: ${refreshTokenValue ? 'Yes (from ' + (req.cookies?.refreshToken ? 'cookie' : 'body') + ')' : 'No'}`);

    const tokens = await authService.refreshAccessToken(refreshTokenValue, deviceInfo);

    logger.debug(`Token refresh successful`);
    logger.debug(`New tokens generated`);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...appConfig.cookie.options,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', tokens.refreshToken, appConfig.cookie.options);

    sendSuccess(res, 'Token refreshed successfully', { tokens });
  } catch (error) {
    logger.error(`[AUTH] Token refresh error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] POST /logout - Logout attempt`);
    logger.debug(`User ID: ${req.userId}`);

    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    await authService.logout(
      req.userId!,
      refreshToken,
      req.deviceInfo,
      false
    );

    logger.debug(`Logout successful`);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    sendSuccess(res, 'Logout successful');
  } catch (error) {
    logger.error(`[AUTH] Logout error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Logout from all devices
 * POST /api/v1/auth/logout-all
 */
export const logoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] POST /logout-all - Logout from all devices`);
    logger.debug(`User ID: ${req.userId}`);

    await authService.logout(req.userId!, undefined, undefined, true);

    logger.debug(`Logged out from all devices`);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    sendSuccess(res, 'Logged out from all devices');
  } catch (error) {
    logger.error(`[AUTH] Logout all error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Change password
 * POST /api/v1/auth/change-password
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] POST /change-password`);
    logger.debug(`User ID: ${req.userId}`);

    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(req.userId!, currentPassword, newPassword);

    logger.debug(`Password changed successfully`);

    // Clear cookies (user needs to login again)
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    sendSuccess(res, 'Password changed successfully. Please login again.');
  } catch (error) {
    logger.error(`[AUTH] Change password error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Get active sessions
 * GET /api/v1/auth/sessions
 */
export const getSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] GET /sessions`);
    logger.debug(`User ID: ${req.userId}`);

    const sessions = await authService.getActiveSessions(req.userId!);

    logger.debug(`Found ${sessions.length} active sessions`);

    sendSuccess(res, 'Sessions retrieved successfully', { sessions });
  } catch (error) {
    logger.error(`[AUTH] Get sessions error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Revoke a session
 * DELETE /api/v1/auth/sessions/:sessionId
 */
export const revokeSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] DELETE /sessions/:sessionId`);
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`Session ID: ${req.params.sessionId}`);

    const { sessionId } = req.params;
    await authService.revokeSession(req.userId!, sessionId);

    logger.debug(`Session revoked successfully`);

    sendSuccess(res, 'Session revoked successfully');
  } catch (error) {
    logger.error(`[AUTH] Revoke session error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Get current user
 * GET /api/v1/auth/me
 */
export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] GET /me`);
    logger.debug(`User ID: ${req.userId}`);
    logger.debug(`User data: ${req.user?.email}`);

    sendSuccess(res, 'User retrieved successfully', { user: req.user });
  } catch (error) {
    logger.error(`[AUTH] Get current user error: ${(error as Error).message}`);
    next(error);
  }
};

// ===========================================
// OAUTH HANDLERS (Google/Apple)
// ===========================================

/**
 * Google OAuth callback handler
 * This would typically be called by Passport.js after Google auth
 */
export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] POST /google/callback - Google OAuth`);
    logger.debug(`Request body: ${JSON.stringify(req.body, null, 2)}`);

    const { googleId, email, displayName, avatar } = req.body;
    const deviceInfo = req.deviceInfo!;

    const { user, tokens, isNewUser } = await authService.googleOAuth(
      googleId,
      email,
      displayName,
      avatar,
      deviceInfo
    );

    logger.debug(`Google OAuth successful`);
    logger.debug(`User: ${user.email}`);
    logger.debug(`New user: ${isNewUser}`);

    sendSuccess(res, isNewUser ? 'Account created successfully' : 'Login successful', {
      user,
      tokens,
      isNewUser,
    });
  } catch (error) {
    logger.error(`[AUTH] Google OAuth error: ${(error as Error).message}`);
    next(error);
  }
};

/**
 * Apple OAuth callback handler
 */
export const appleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug(`[AUTH] POST /apple/callback - Apple OAuth`);
    logger.debug(`Request body: ${JSON.stringify(req.body, null, 2)}`);

    const { appleId, email, displayName } = req.body;
    const deviceInfo = req.deviceInfo!;

    const { user, tokens, isNewUser } = await authService.appleOAuth(
      appleId,
      email,
      displayName,
      deviceInfo
    );

    logger.debug(`Apple OAuth successful`);
    logger.debug(`User: ${user.email}`);
    logger.debug(`New user: ${isNewUser}`);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...appConfig.cookie.options,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, appConfig.cookie.options);

    // Redirect to frontend with success
    const redirectUrl = `${appConfig.frontend.url}/auth/callback?success=true&isNewUser=${isNewUser}`;
    logger.debug(`Redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error(`[AUTH] Apple OAuth error: ${(error as Error).message}`);
    const redirectUrl = `${appConfig.frontend.url}/auth/callback?success=false&error=${encodeURIComponent((error as Error).message)}`;
    res.redirect(redirectUrl);
  }
};

export default {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  changePassword,
  getSessions,
  revokeSession,
  getCurrentUser,
  googleCallback,
  appleCallback,
};
