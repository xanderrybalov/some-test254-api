import { Request, Response, NextFunction } from 'express';
import { moviesService } from './movies.service.js';
import logger from '../config/logger.js';

export class MoviesController {
  /**
   * POST /api/movies/search
   */
  async searchMovies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { query, page } = req.body;

      const result = await moviesService.searchMovies(query, page);

      res.json({
        items: result.items.map(movie => ({
          id: movie.id,
          omdbId: movie.omdbId,
          title: movie.title,
          year: movie.year,
          runtimeMinutes: movie.runtimeMinutes,
          genre: movie.genre,
          director: movie.director,
          source: movie.source,
        })),
        page: page,
        total: result.total,
      });
    } catch (error) {
      logger.error('Failed to search movies', { body: req.body, error });
      next(error);
    }
  }

  /**
   * GET /api/movies/:movieId
   */
  async getMovie(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { movieId } = req.params;

      if (!movieId) {
        res.status(400).json({ error: 'Movie ID is required' });
        return;
      }

      const movie = await moviesService.getMovieById(movieId);

      if (!movie) {
        res.status(404).json({ error: 'Movie not found' });
        return;
      }

      res.json({
        id: movie.id,
        omdbId: movie.omdbId,
        title: movie.title,
        year: movie.year,
        runtimeMinutes: movie.runtimeMinutes,
        genre: movie.genre,
        director: movie.director,
        source: movie.source,
      });
    } catch (error) {
      logger.error('Failed to get movie', {
        movieId: req.params.movieId,
        error,
      });
      next(error);
    }
  }

  /**
   * POST /api/movies/by-ids
   */
  async getMoviesByIds(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids)) {
        res.status(400).json({ error: 'ids must be an array' });
        return;
      }

      const movies = await moviesService.getMoviesByIds(ids);

      res.json(
        movies.map(movie => ({
          id: movie.id,
          omdbId: movie.omdbId,
          title: movie.title,
          year: movie.year,
          runtimeMinutes: movie.runtimeMinutes,
          genre: movie.genre,
          director: movie.director,
          source: movie.source,
        }))
      );
    } catch (error) {
      logger.error('Failed to get movies by IDs', { body: req.body, error });
      next(error);
    }
  }
}

export const moviesController = new MoviesController();
