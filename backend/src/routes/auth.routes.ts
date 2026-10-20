import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { authRateLimiter, registerRateLimiter } from '../middleware/rate-limiter';

const router = Router();

router.post('/auth/register', registerRateLimiter, register);
router.post('/auth/login', authRateLimiter, login);
router.post('/auth/logout', optionalAuth, logout);
router.get('/auth/me', optionalAuth, getMe);

export default router;
