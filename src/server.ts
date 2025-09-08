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

// Start server
server.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`, {
    environment: env.NODE_ENV,
    port: env.PORT,
  });
});
