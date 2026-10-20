import rateLimit from 'express-rate-limit';

// Auth rate limiter: 15 attempts per 15 minutes per IP
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
});

// Registration rate limiter: 5 accounts per hour per IP
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many registration requests from this IP. Please try again later.',
    },
  },
});

// AI connection test rate limiter: 20 per minute
export const aiTestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many AI test requests. Please wait a moment before trying again.',
    },
  },
});

// Deep diagnostic rate limiter: 10 per minute
export const analyzeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Diagnostic rate limit reached. Please wait a moment before triggering another deep analysis.',
    },
  },
});
