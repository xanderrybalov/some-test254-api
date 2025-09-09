import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { JWTPayload, RegisterRequest, LoginRequest, LoginResponse } from '../domain/types.js';
import { usersService } from '../users/users.service.js';
import logger from '../config/logger.js';

// Validation schemas
const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore and dash')
    .trim(),
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email must be at most 255 characters')
    .trim()
    .toLowerCase()
    .optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/(?=.*\d)/, 'Password must contain at least one number'),
});

const loginSchema = z.object({
  login: z.string().min(1, 'Login is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export class AuthService {
  /**
   * Hash password using Argon2id with optional pepper
   */
  async hashPassword(password: string): Promise<string> {
    try {
      // Add pepper if configured
      const passwordWithPepper = env.PASSWORD_PEPPER 
        ? password + env.PASSWORD_PEPPER 
        : password;

      // Use Argon2id with secure defaults
      const hash = await argon2.hash(passwordWithPepper, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,       // 3 iterations
        parallelism: 4,    // 4 threads
        hashLength: 32,    // 32 bytes output
      });

      return hash;
    } catch (error) {
      logger.error('Failed to hash password', { error });
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      // Add pepper if configured
      const passwordWithPepper = env.PASSWORD_PEPPER 
        ? password + env.PASSWORD_PEPPER 
        : password;

      return await argon2.verify(hash, passwordWithPepper);
    } catch (error) {
      logger.error('Failed to verify password', { error });
      return false;
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    try {
      return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
        issuer: 'movies-api',
        audience: 'movies-app',
      } as jwt.SignOptions);
    } catch (error) {
      logger.error('Failed to generate JWT token', { error });
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET, {
        issuer: 'movies-api',
        audience: 'movies-app',
      } as jwt.VerifyOptions) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new Error('Token not active');
      }
      logger.error('Failed to verify JWT token', { error });
      throw new Error('Token verification failed');
    }
  }

  /**
   * Register new user
   */
  async register(data: RegisterRequest): Promise<LoginResponse> {
    const validated = registerSchema.parse(data);

    // Check if username already exists
    const existingUser = await usersService.findByUsername(validated.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Check if email already exists (if provided)
    if (validated.email) {
      const existingEmailUser = await usersService.findByEmail(validated.email);
      if (existingEmailUser) {
        throw new Error('Email already exists');
      }
    }

    // Hash password
    const passwordHash = await this.hashPassword(validated.password);

    // Create user
    const user = await usersService.createWithPassword({
      username: validated.username,
      email: validated.email || null,
      passwordHash,
    });

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      username: user.username,
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }

  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const validated = loginSchema.parse(data);

    // Find user by username or email
    const user = await usersService.findByUsernameOrEmail(validated.login);
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(validated.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      username: user.username,
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }
}

export const authService = new AuthService();
