import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import logger from '../config/logger.js';

export class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error) {
        // Handle known validation and business logic errors
        if (
          error.message.includes('Username already exists') ||
          error.message.includes('Email already exists') ||
          error.message.includes('must be at least') ||
          error.message.includes('must be at most') ||
          error.message.includes('must contain') ||
          error.message.includes('Invalid email') ||
          error.message.includes('can only contain')
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }

      logger.error('Failed to register user', {
        body: req.body,
        error,
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        // Handle known validation and business logic errors
        if (
          error.message.includes('Invalid credentials') ||
          error.message.includes('is required')
        ) {
          res.status(401).json({ error: error.message });
          return;
        }
      }

      logger.error('Failed to login user', {
        body: { login: req.body.login }, // Don't log password
        error,
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/verify
   * Verify token and return user info (for token validation)
   * Token can be passed via Authorization header OR in request body
   */
  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Try to get token from Authorization header first
      let token = req.headers.authorization?.replace('Bearer ', '');
      
      // If not found in header, try to get from request body
      if (!token && req.body?.token) {
        token = req.body.token;
      }
      
      if (!token) {
        res.status(401).json({ 
          error: 'Token is required',
          message: 'Provide token via Authorization header or in request body'
        });
        return;
      }

      const payload = authService.verifyToken(token);
      
      res.json({
        valid: true,
        user: {
          id: payload.userId,
          username: payload.username,
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('Invalid token') ||
          error.message.includes('Token expired') ||
          error.message.includes('Token not active')
        ) {
          res.status(401).json({ 
            valid: false,
            error: error.message 
          });
          return;
        }
      }

      logger.error('Failed to verify token', { error });
      next(error);
    }
  }
}

export const authController = new AuthController();
