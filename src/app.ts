import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';

import logger from './config/logger.js';
import { corsMiddleware } from './middlewares/cors.js';
import { globalRateLimit } from './middlewares/rateLimit.js';
import { errorHandler } from './middlewares/error.js';
import { notFoundHandler } from './middlewares/notFound.js';
import routes from './routes.js';

const app = express();

// Trust proxy for accurate client IPs (when behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS
app.use(corsMiddleware);

// Compression
app.use(compression());

// Request logging
app.use(pinoHttp({ logger }));

// Rate limiting
app.use(globalRateLimit);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
