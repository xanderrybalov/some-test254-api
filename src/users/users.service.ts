import { User } from '../domain/types.js';
import { usersRepo } from './users.repo.js';

export class UsersService {

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

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return usersRepo.findByEmail(email);
  }

  /**
   * Find user by username or email (for login)
   */
  async findByUsernameOrEmail(login: string): Promise<(User & { passwordHash?: string }) | null> {
    return usersRepo.findByUsernameOrEmail(login);
  }

  /**
   * Create user with password (for registration)
   */
  async createWithPassword(data: {
    username: string;
    email: string | null;
    passwordHash: string;
  }): Promise<User> {
    return usersRepo.createWithPassword(data);
  }
}

export const usersService = new UsersService();
