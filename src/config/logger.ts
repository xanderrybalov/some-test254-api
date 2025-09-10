import pino from 'pino';
import { env } from './env.js';

const isDevelopment = env.NODE_ENV === 'development';

// Create logger with conditional pino-pretty only in development
export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  // Only use pino-pretty transport in development
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }),
});

export default logger;
