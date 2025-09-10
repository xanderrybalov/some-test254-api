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
import db from './db/index.js';

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

// Health check endpoint with database diagnostics
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Basic health info
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: false,
        tables: {},
        migrations: [],
        usersTableReady: false
      }
    };

    // Check database connection
    try {
      const dbInfo = await db.checkConnection();
      health.database.connected = true;
      
      // Check tables
      const tables = await db.checkTables();
      health.database.tables = tables;
      
      // Check migrations
      const migrations = await db.checkMigrations();
      health.database.migrations = migrations;
      
      // Check users table structure
      const usersStructure = await db.checkUsersTableStructure();
      health.database.usersTableReady = usersStructure.hasEmail && usersStructure.hasPasswordHash;
      
      logger.info('Health check completed successfully', {
        duration: Date.now() - startTime,
        tablesStatus: tables,
        migrationsCount: migrations.length,
        usersTableReady: health.database.usersTableReady
      });
      
    } catch (dbError) {
      health.status = 'degraded';
      health.database.connected = false;
      logger.error('Health check database error', { 
        error: dbError,
        duration: Date.now() - startTime
      });
    }

    // Return appropriate status code
    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Detailed diagnostics endpoint (for debugging)
app.get('/diagnostics', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  
    try {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: {
          connection: null as any,
          tables: null as any,
          migrations: null as any,
          usersStructure: null as any,
          error: undefined as string | undefined
        }
      };

      try {
        diagnostics.database.connection = await db.checkConnection();
        diagnostics.database.tables = await db.checkTables();
        diagnostics.database.migrations = await db.checkMigrations();
        diagnostics.database.usersStructure = await db.checkUsersTableStructure();
      } catch (dbError) {
        diagnostics.database.error = dbError instanceof Error ? dbError.message : 'Unknown database error';
      }

      res.json(diagnostics);
    } catch (error) {
      res.status(500).json({ 
        error: 'Diagnostics failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
});

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
