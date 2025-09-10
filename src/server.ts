import { createServer } from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import logger from './config/logger.js';
import db from './db/index.js';

const server = createServer(app);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await db.end();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections', error);
    }
    
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Database initialization check
const initializeDatabase = async () => {
  try {
    logger.info('Checking database connection and structure...');
    
    // Check basic connection
    const dbInfo = await db.checkConnection();
    logger.info('Database connection established', {
      database: dbInfo.current_database,
      user: dbInfo.current_user,
      version: dbInfo.version?.substring(0, 50) // truncate long version string
    });

    // Check tables
    const tables = await db.checkTables();
    logger.info('Database tables check completed', { tables });

    // Check migrations
    const migrations = await db.checkMigrations();
    logger.info('Database migrations check completed', { 
      migrationsCount: migrations.length,
      latestMigration: migrations[0]?.name
    });

    // Check users table structure
    const usersStructure = await db.checkUsersTableStructure();
    logger.info('Users table structure check completed', {
      hasEmail: usersStructure.hasEmail,
      hasPasswordHash: usersStructure.hasPasswordHash,
      readyForAuth: usersStructure.hasEmail && usersStructure.hasPasswordHash
    });

    if (!usersStructure.hasEmail || !usersStructure.hasPasswordHash) {
      logger.warn('Users table missing authentication fields!', {
        missingFields: [
          !usersStructure.hasEmail && 'email',
          !usersStructure.hasPasswordHash && 'password_hash'
        ].filter(Boolean)
      });
    }

  } catch (error) {
    logger.error('Database initialization check failed', { error });
    // Don't exit on database errors - let the app start and show errors in health endpoint
  }
};

// Start server
server.listen(env.PORT, async () => {
  logger.info(`Server running on port ${env.PORT}`, {
    environment: env.NODE_ENV,
    port: env.PORT,
  });
  
  // Initialize database checks after server starts
  await initializeDatabase();
});
