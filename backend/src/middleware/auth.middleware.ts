import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth/auth.service';
import { SafeUser } from '../models/user.model';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
  sessionId?: string;
}

export const SESSION_COOKIE_NAME = 'k8s_session';

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME] || req.headers['x-session-id'] || extractBearerToken(req);

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(401).json({ error: { message: 'Authentication required. Please log in.' } });
    return;
  }

  const user = validateSession(sessionId);
  if (!user) {
    // Clear invalid/expired cookie
    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(401).json({ error: { message: 'Session expired or invalid. Please log in again.' } });
    return;
  }

  req.user = user;
  req.sessionId = sessionId;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME] || req.headers['x-session-id'] || extractBearerToken(req);

  if (sessionId && typeof sessionId === 'string') {
    const user = validateSession(sessionId);
    if (user) {
      req.user = user;
      req.sessionId = sessionId;
    }
  }

  next();
}

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return undefined;
}
