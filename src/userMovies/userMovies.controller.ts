import { Request, Response, NextFunction } from 'express';
import { moviesService } from '../movies/movies.service.js';
import logger from '../config/logger.js';

export class UserMoviesController {
  /**
   * GET /api/users/:userId/movies
   */
  async getUserMovies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const { favorites } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const favoritesOnly = favorites === 'true';
      const movies = await moviesService.getUserMovies(userId, favoritesOnly);

      res.json(movies);
    } catch (error) {
      logger.error('Failed to get user movies', {
        userId: req.params.userId,
        query: req.query,
        error,
      });
      next(error);
    }
  }

  /**
   * POST /api/users/:userId/movies
   */
  async createUserMovie(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const movie = await moviesService.createCustomMovie(userId, req.body);

      res.status(201).json({
        id: movie.id,
        title: movie.title,
        year: movie.year,
        runtimeMinutes: movie.runtimeMinutes,
        genre: movie.genre,
        director: movie.director,
        poster: movie.poster,
        source: movie.source,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('A movie with the same name already exists')) {
          res.status(409).json({ error: error.message });
          return;
        }
      }

      logger.error('Failed to create user movie', {
        userId: req.params.userId,
        body: req.body,
        error,
      });
      next(error);
    }
  }

  /**
   * PUT /api/users/:userId/movies/:movieId
   */
  async updateUserMovie(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId, movieId } = req.params;

      if (!userId || !movieId) {
        res.status(400).json({ error: 'User ID and Movie ID are required' });
        return;
      }

      const result = await moviesService.updateMovie(userId, movieId, req.body);

      if (!result) {
        res.status(404).json({ error: 'Movie not found' });
        return;
      }

      // Get the updated movie with user data merged
      const userMovies = await moviesService.getUserMovies(userId, false);
      const updatedMovie = userMovies.find(m => m.id === movieId);

      if (!updatedMovie) {
        res.status(404).json({ error: 'Movie not found' });
        return;
      }

      res.json(updatedMovie);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('A movie with the same name already exists')) {
          res.status(409).json({ error: error.message });
          return;
        }
      }

      logger.error('Failed to update user movie', {
        userId: req.params.userId,
        movieId: req.params.movieId,
        body: req.body,
        error,
      });
      next(error);
    }
  }

  /**
   * PUT /api/users/:userId/movies/:movieId/favorite
   */
  async setFavorite(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId, movieId } = req.params;
      const { isFavorite } = req.body;

      if (!userId || !movieId) {
        res.status(400).json({ error: 'User ID and Movie ID are required' });
        return;
      }

      if (typeof isFavorite !== 'boolean') {
        res.status(400).json({ error: 'isFavorite must be a boolean' });
        return;
      }

      const success = await moviesService.setFavorite(
        userId,
        movieId,
        isFavorite
      );

      if (!success) {
        res.status(404).json({ error: 'Movie not found' });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      logger.error('Failed to set favorite', {
        userId: req.params.userId,
        movieId: req.params.movieId,
        body: req.body,
        error,
      });
      next(error);
    }
  }

  /**
   * DELETE /api/users/:userId/movies/:movieId
   */
  async deleteUserMovie(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    logger.debug('UserMoviesController: DELETE request received', {
      userId: req.params.userId,
      movieId: req.params.movieId
    });

    try {
      const { userId, movieId } = req.params;

      if (!userId || !movieId) {
        logger.warn('UserMoviesController: Missing userId or movieId', {
          userId,
          movieId
        });
        res.status(400).json({ error: 'User ID and Movie ID are required' });
        return;
      }

      logger.debug('UserMoviesController: Calling moviesService.deleteMovie', {
        userId,
        movieId
      });

      const success = await moviesService.deleteMovie(userId, movieId);

      logger.debug('UserMoviesController: MoviesService.deleteMovie result', {
        userId,
        movieId,
        success
      });

      if (!success) {
        logger.warn('UserMoviesController: Movie not found or delete failed', {
          userId,
          movieId
        });
        res.status(404).json({ error: 'Movie not found' });
        return;
      }

      logger.debug('UserMoviesController: Delete successful', {
        userId,
        movieId
      });

      res.json({ ok: true });
    } catch (error) {
      logger.error('UserMoviesController: Failed to delete user movie', {
        userId: req.params.userId,
        movieId: req.params.movieId,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  }
}

export const userMoviesController = new UserMoviesController();
