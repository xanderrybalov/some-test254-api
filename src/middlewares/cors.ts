import cors from 'cors';
import { env } from '../config/env.js';

/**
 * CORS configuration
 */
export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
});
