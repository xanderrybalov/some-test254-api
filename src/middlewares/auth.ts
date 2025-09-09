import { Request, Response, NextFunction } from 'express';
import { authService } from '../auth/auth.service.js';
import logger from '../config/logger.js';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      };
    }
  }
}

/**
 * JWT Authentication middleware
 * Verifies JWT token from Authorization header and sets req.user
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      res.status(401).json({ 
        error: 'Access denied',
        message: 'Authorization token is required'
      });
      return;
    }

    const payload = authService.verifyToken(token);
    
    req.user = {
      id: payload.userId,
      username: payload.username,
    };

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('Invalid token') ||
        error.message.includes('Token expired') ||
        error.message.includes('Token not active')
      ) {
        res.status(401).json({ 
          error: 'Access denied',
          message: error.message
        });
        return;
      }
    }

    logger.error('JWT authentication failed', { error });
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional JWT Authentication middleware
 * Sets req.user if token is valid, but doesn't fail if token is missing
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      next();
      return;
    }

    const payload = authService.verifyToken(token);
    
    req.user = {
      id: payload.userId,
      username: payload.username,
    };

    next();
  } catch (error) {
    // For optional auth, we just ignore invalid tokens and continue
    logger.debug('Optional auth failed, continuing without user', { error });
    next();
  }
}
