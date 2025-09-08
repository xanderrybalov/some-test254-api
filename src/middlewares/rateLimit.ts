import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Global rate limiter
 */
export const globalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for search endpoints
 */
export const searchRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: 'Too many search requests',
    message: 'You have exceeded the search rate limit. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
