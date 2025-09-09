import { Router } from 'express';
import { z } from 'zod';
import { moviesController } from './movies/movies.controller.js';
import { userMoviesController } from './userMovies/userMovies.controller.js';
import { authController } from './auth/auth.controller.js';
import { validateBody, validateParams } from './middlewares/validate.js';
import { searchRateLimit } from './middlewares/rateLimit.js';
import { authenticateToken, optionalAuth } from './middlewares/auth.js';

const router = Router();

// Validation schemas
const uuidSchema = z.object({
  userId: z.string().uuid(),
});

const movieParamsSchema = z.object({
  userId: z.string().uuid(),
  movieId: z.string().uuid(),
});


const createMovieSchema = z.object({
  title: z.string().min(3).trim(),
  year: z.number().int().min(1888).max(2100),
  runtimeMinutes: z.number().int().min(1),
  genre: z.array(z.string().min(3)).min(1),
  director: z.array(z.string().min(3)).min(1),
  poster: z.string().url().optional(),
});

const updateMovieSchema = z.object({
  title: z.string().min(3).trim().optional(),
  year: z.number().int().min(1888).max(2100).optional(),
  runtimeMinutes: z.number().int().min(1).optional(),
  genre: z.array(z.string().min(3)).min(1).optional(),
  director: z.array(z.string().min(3)).min(1).optional(),
  // poster is immutable - cannot be updated
});

const setFavoriteSchema = z.object({
  isFavorite: z.boolean(),
});

const getMoviesByIdsSchema = z.object({
  ids: z.array(z.string().uuid()),
});

const searchMoviesSchema = z.object({
  query: z.string().min(1, 'Query must be at least 1 character').trim(),
  page: z.number().int().min(1).optional().default(1),
});

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

// Authentication routes (public)
router.post(
  '/auth/register',
  validateBody(registerSchema),
  authController.register.bind(authController)
);

router.post(
  '/auth/login',
  validateBody(loginSchema),
  authController.login.bind(authController)
);

router.post(
  '/auth/verify',
  authController.verify.bind(authController)
);


// Movies routes
router.post(
  '/movies/search',
  searchRateLimit,
  validateBody(searchMoviesSchema),
  moviesController.searchMovies.bind(moviesController)
);

router.get(
  '/movies/:movieId',
  moviesController.getMovie.bind(moviesController)
);

router.post(
  '/movies/by-ids',
  validateBody(getMoviesByIdsSchema),
  moviesController.getMoviesByIds.bind(moviesController)
);

// User movies routes (protected - require authentication)
router.get(
  '/users/:userId/movies',
  authenticateToken,
  validateParams(uuidSchema),
  userMoviesController.getUserMovies.bind(userMoviesController)
);

router.post(
  '/users/:userId/movies',
  authenticateToken,
  validateParams(uuidSchema),
  validateBody(createMovieSchema),
  userMoviesController.createUserMovie.bind(userMoviesController)
);

router.put(
  '/users/:userId/movies/:movieId',
  authenticateToken,
  validateParams(movieParamsSchema),
  validateBody(updateMovieSchema),
  userMoviesController.updateUserMovie.bind(userMoviesController)
);

router.put(
  '/users/:userId/movies/:movieId/favorite',
  authenticateToken,
  validateParams(movieParamsSchema),
  validateBody(setFavoriteSchema),
  userMoviesController.setFavorite.bind(userMoviesController)
);

router.delete(
  '/users/:userId/movies/:movieId',
  authenticateToken,
  validateParams(movieParamsSchema),
  userMoviesController.deleteUserMovie.bind(userMoviesController)
);

export default router;
