import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service.js';
import logger from '../config/logger.js';

export class UsersController {
  /**
   * POST /api/users/ensure
   */
  async ensureUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.ensureUser(req.body);
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
        },
      });
    } catch (error) {
      logger.error('Failed to ensure user', { body: req.body, error });
      next(error);
    }
  }
}

export const usersController = new UsersController();
