// ===========================================
// PROCONNECT - AUTH CONTROLLER
// Authentication API handlers with testing logs
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/apiResponse';
import { appConfig } from '../config';

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
    console.log('\n📝 [AUTH] POST /register - Registration attempt');
    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));

    const { email, password, username, displayName } = req.body;
    const deviceInfo = req.deviceInfo!;

    console.log('📱 Device info:', deviceInfo);

    const { user, tokens } = await authService.register(
      email,
      password,
      username,
      displayName,
      deviceInfo
    );

    console.log('✅ Registration successful for user:', user.email);
    console.log('🔑 Tokens generated:', {
      accessToken: tokens.accessToken.substring(0, 20) + '...',
      refreshToken: tokens.refreshToken.substring(0, 20) + '...',
    });

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
    console.error('❌ [AUTH] Registration error:', (error as Error).message);
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
    console.log('\n🔐 [AUTH] POST /login - Login attempt');
    console.log('📥 Request body:', { email: req.body.email, password: '***' });

    const { email, password } = req.body;
    const deviceInfo = req.deviceInfo!;

    console.log('📱 Device info:', deviceInfo);

    const { user, tokens } = await authService.login(email, password, deviceInfo);

    console.log('✅ Login successful for user:', user.email);
    console.log('🔑 Tokens generated:', {
      accessToken: tokens.accessToken.substring(0, 20) + '...',
      refreshToken: tokens.refreshToken.substring(0, 20) + '...',
    });

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
    console.error('❌ [AUTH] Login error:', (error as Error).message);
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
    console.log('\n🔄 [AUTH] POST /refresh - Token refresh attempt');
    
    const refreshTokenValue = req.cookies?.refreshToken || req.body?.refreshToken;
    const deviceInfo = req.deviceInfo!;

    console.log('🔑 Refresh token provided:', refreshTokenValue ? 'Yes (from ' + (req.cookies?.refreshToken ? 'cookie' : 'body') + ')' : 'No');

    const tokens = await authService.refreshAccessToken(refreshTokenValue, deviceInfo);

    console.log('✅ Token refresh successful');
    console.log('🔑 New tokens generated');

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...appConfig.cookie.options,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', tokens.refreshToken, appConfig.cookie.options);

    sendSuccess(res, 'Token refreshed successfully', { tokens });
  } catch (error) {
    console.error('❌ [AUTH] Token refresh error:', (error as Error).message);
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
    console.log('\n🚪 [AUTH] POST /logout - Logout attempt');
    console.log('👤 User ID:', req.userId);

    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    await authService.logout(
      req.userId!,
      refreshToken,
      req.deviceInfo,
      false
    );

    console.log('✅ Logout successful');

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    sendSuccess(res, 'Logout successful');
  } catch (error) {
    console.error('❌ [AUTH] Logout error:', (error as Error).message);
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
    console.log('\n🚪🔒 [AUTH] POST /logout-all - Logout from all devices');
    console.log('👤 User ID:', req.userId);

    await authService.logout(req.userId!, undefined, undefined, true);

    console.log('✅ Logged out from all devices');

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    sendSuccess(res, 'Logged out from all devices');
  } catch (error) {
    console.error('❌ [AUTH] Logout all error:', (error as Error).message);
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
    console.log('\n🔒 [AUTH] POST /change-password');
    console.log('👤 User ID:', req.userId);

    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(req.userId!, currentPassword, newPassword);

    console.log('✅ Password changed successfully');

    // Clear cookies (user needs to login again)
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    sendSuccess(res, 'Password changed successfully. Please login again.');
  } catch (error) {
    console.error('❌ [AUTH] Change password error:', (error as Error).message);
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
    console.log('\n📋 [AUTH] GET /sessions');
    console.log('👤 User ID:', req.userId);

    const sessions = await authService.getActiveSessions(req.userId!);

    console.log('✅ Found', sessions.length, 'active sessions');

    sendSuccess(res, 'Sessions retrieved successfully', { sessions });
  } catch (error) {
    console.error('❌ [AUTH] Get sessions error:', (error as Error).message);
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
    console.log('\n🗑️ [AUTH] DELETE /sessions/:sessionId');
    console.log('👤 User ID:', req.userId);
    console.log('🎯 Session ID:', req.params.sessionId);

    const { sessionId } = req.params;
    await authService.revokeSession(req.userId!, sessionId);

    console.log('✅ Session revoked successfully');

    sendSuccess(res, 'Session revoked successfully');
  } catch (error) {
    console.error('❌ [AUTH] Revoke session error:', (error as Error).message);
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
    console.log('\n👤 [AUTH] GET /me');
    console.log('👤 User ID:', req.userId);
    console.log('✅ User data:', req.user?.email);

    sendSuccess(res, 'User retrieved successfully', { user: req.user });
  } catch (error) {
    console.error('❌ [AUTH] Get current user error:', (error as Error).message);
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
    console.log('\n🔵 [AUTH] POST /google/callback - Google OAuth');
    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));

    const { googleId, email, displayName, avatar } = req.body;
    const deviceInfo = req.deviceInfo!;

    const { user, tokens, isNewUser } = await authService.googleOAuth(
      googleId,
      email,
      displayName,
      avatar,
      deviceInfo
    );

    console.log('✅ Google OAuth successful');
    console.log('👤 User:', user.email);
    console.log('🆕 New user:', isNewUser);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...appConfig.cookie.options,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, appConfig.cookie.options);

    // Redirect to frontend with success
    const redirectUrl = `${appConfig.frontend.url}/auth/callback?success=true&isNewUser=${isNewUser}`;
    console.log('➡️ Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ [AUTH] Google OAuth error:', (error as Error).message);
    // Redirect to frontend with error
    const redirectUrl = `${appConfig.frontend.url}/auth/callback?success=false&error=${encodeURIComponent((error as Error).message)}`;
    res.redirect(redirectUrl);
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
    console.log('\n🍎 [AUTH] POST /apple/callback - Apple OAuth');
    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));

    const { appleId, email, displayName } = req.body;
    const deviceInfo = req.deviceInfo!;

    const { user, tokens, isNewUser } = await authService.appleOAuth(
      appleId,
      email,
      displayName,
      deviceInfo
    );

    console.log('✅ Apple OAuth successful');
    console.log('👤 User:', user.email);
    console.log('🆕 New user:', isNewUser);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...appConfig.cookie.options,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, appConfig.cookie.options);

    // Redirect to frontend with success
    const redirectUrl = `${appConfig.frontend.url}/auth/callback?success=true&isNewUser=${isNewUser}`;
    console.log('➡️ Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ [AUTH] Apple OAuth error:', (error as Error).message);
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
