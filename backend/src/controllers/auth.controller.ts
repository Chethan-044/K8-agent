import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  logoutSession,
} from '../services/auth/auth.service';
import { AuthenticatedRequest, SESSION_COOKIE_NAME } from '../middleware/auth.middleware';
import { config } from '../config/config';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, email, password, confirmPassword } = req.body;
    const user = await registerUser(
      { username, email, password, confirmPassword },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully. You can now log in.',
      user,
    });
  } catch (err: any) {
    res.status(400).json({
      error: {
        message: err.message || 'Registration failed. Please check your details.',
      },
    });
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = req.body;
    const authResult = await loginUser(
      { identifier, password },
      req.ip
    );

    // Set secure HttpOnly cookie
    const isProduction = config.nodeEnv === 'production';
    res.cookie(SESSION_COOKIE_NAME, authResult.sessionId, {
      httpOnly: true,
      secure: isProduction, // HTTPS in production
      sameSite: 'lax',
      expires: authResult.expiresAt,
      path: '/',
    });

    res.json({
      authenticated: true,
      user: authResult.user,
      sessionId: authResult.sessionId, // Also returned for programmatic API clients
    });
  } catch (err: any) {
    res.status(401).json({
      error: {
        message: err.message || 'Invalid username or password.',
      },
    });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME] || req.sessionId;
    if (sessionId) {
      logoutSession(sessionId, req.ip);
    }

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({
      authenticated: false,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user) {
    res.json({
      authenticated: true,
      user: req.user,
    });
  } else {
    res.json({
      authenticated: false,
    });
  }
}
