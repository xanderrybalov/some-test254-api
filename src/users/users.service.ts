import { z } from 'zod';
import { User } from '../domain/types.js';
import { usersRepo } from './users.repo.js';

const createUserSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .trim(),
});

export class UsersService {
  /**
   * Ensure user exists (find or create)
   */
  async ensureUser(data: { username: string }): Promise<User> {
    const validated = createUserSchema.parse(data);
    return usersRepo.upsert(validated.username);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return usersRepo.findById(id);
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    return usersRepo.findByUsername(username);
  }
}

export const usersService = new UsersService();
