import { Router } from 'express';
import { z } from 'zod';
import { usersController } from './users/users.controller.js';
import { moviesController } from './movies/movies.controller.js';
import { userMoviesController } from './userMovies/userMovies.controller.js';
import { validateBody, validateParams } from './middlewares/validate.js';
import { searchRateLimit } from './middlewares/rateLimit.js';

const router = Router();

// Validation schemas
const uuidSchema = z.object({
  userId: z.string().uuid(),
});

const movieParamsSchema = z.object({
  userId: z.string().uuid(),
  movieId: z.string().uuid(),
});

const createUserSchema = z.object({
  username: z.string().min(3).max(50).trim(),
});

const createMovieSchema = z.object({
  title: z.string().min(3).trim(),
  year: z.number().int().min(1888).max(2100),
  runtimeMinutes: z.number().int().min(1),
  genre: z.array(z.string().min(3)).min(1),
  director: z.array(z.string().min(3)).min(1),
});

const updateMovieSchema = z.object({
  title: z.string().min(3).trim().optional(),
  year: z.number().int().min(1888).max(2100).optional(),
  runtimeMinutes: z.number().int().min(1).optional(),
  genre: z.array(z.string().min(3)).min(1).optional(),
  director: z.array(z.string().min(3)).min(1).optional(),
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

// Users routes
router.post(
  '/users/ensure',
  validateBody(createUserSchema),
  usersController.ensureUser.bind(usersController)
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

// User movies routes
router.get(
  '/users/:userId/movies',
  validateParams(uuidSchema),
  userMoviesController.getUserMovies.bind(userMoviesController)
);

router.post(
  '/users/:userId/movies',
  validateParams(uuidSchema),
  validateBody(createMovieSchema),
  userMoviesController.createUserMovie.bind(userMoviesController)
);

router.put(
  '/users/:userId/movies/:movieId',
  validateParams(movieParamsSchema),
  validateBody(updateMovieSchema),
  userMoviesController.updateUserMovie.bind(userMoviesController)
);

router.put(
  '/users/:userId/movies/:movieId/favorite',
  validateParams(movieParamsSchema),
  validateBody(setFavoriteSchema),
  userMoviesController.setFavorite.bind(userMoviesController)
);

router.delete(
  '/users/:userId/movies/:movieId',
  validateParams(movieParamsSchema),
  userMoviesController.deleteUserMovie.bind(userMoviesController)
);

export default router;
