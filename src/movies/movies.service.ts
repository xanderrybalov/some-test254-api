import { z } from 'zod';
import {
  Movie,
  CreateMovieRequest,
  UpdateMovieRequest,
} from '../domain/types.js';
import { normalizeTitle } from '../domain/normalize.js';
import { moviesRepo } from './movies.repo.js';
import { userMoviesRepo } from '../userMovies/userMovies.repo.js';
import { omdbService } from '../omdb/omdb.service.js';
import logger from '../config/logger.js';

const createMovieSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').trim(),
  year: z.number().int().min(1888).max(2100),
  runtimeMinutes: z.number().int().min(1),
  genre: z.array(z.string().min(3)).min(1, 'At least one genre is required'),
  director: z
    .array(z.string().min(3))
    .min(1, 'At least one director is required'),
  poster: z.string().url().optional(),
});

const updateMovieSchema = z.object({
  title: z.string().min(3).trim().optional(),
  year: z.number().int().min(1888).max(2100).optional(),
  runtimeMinutes: z.number().int().min(1).optional(),
  genre: z.array(z.string().min(3)).min(1).optional(),
  director: z.array(z.string().min(3)).min(1).optional(),
  // poster is immutable - can only be set during creation
});

export class MoviesService {
  /**
   * Search movies via OMDB API
   */
  async searchMovies(query: string, page: number = 1) {
    if (query.length < 1) {
      throw new Error('Query must be at least 1 character');
    }

    return omdbService.searchMovies(query, page);
  }

  /**
   * Hybrid search - combines OMDB results with custom movies
   */
  async searchMoviesHybrid(query: string, page: number = 1, includeCustom: boolean = true) {
    if (query.length < 1) {
      throw new Error('Query must be at least 1 character');
    }

    // Always search OMDB
    const omdbResults = await omdbService.searchMovies(query, page);

    if (!includeCustom) {
      return omdbResults;
    }

    // Search custom movies in parallel
    const customMovies = await moviesRepo.searchByTitle(query, 10); // Limit custom results

    // Combine results - put custom movies first, then OMDB
    const combinedItems = [
      ...customMovies,
      ...omdbResults.items.filter(omdbMovie => 
        // Avoid duplicates by checking if any custom movie has similar title
        !customMovies.some(customMovie => 
          customMovie.title.toLowerCase() === omdbMovie.title.toLowerCase()
        )
      )
    ];

    return {
      items: combinedItems,
      page,
      total: omdbResults.total + customMovies.length,
    };
  }

  /**
   * Get movie by ID
   */
  async getMovieById(movieId: string): Promise<Movie | null> {
    return moviesRepo.findById(movieId);
  }

  /**
   * Get multiple movies by IDs
   */
  async getMoviesByIds(ids: string[]): Promise<Movie[]> {
    return moviesRepo.findByIds(ids);
  }

  /**
   * Create custom movie
   */
  async createCustomMovie(
    userId: string,
    data: CreateMovieRequest
  ): Promise<Movie> {
    const validated = createMovieSchema.parse(data);
    const normalizedTitle = normalizeTitle(validated.title);

    // Check for duplicate title in user's collection
    const existingUserMovie = 
      await userMoviesRepo.findByUserAndEffectiveTitle(userId, normalizedTitle);
    if (existingUserMovie) {
      throw new Error('A movie with the same name already exists in your collection.');
    }

    // Create movie
    const movie = await moviesRepo.create({
      title: validated.title,
      normalizedTitle,
      year: validated.year,
      runtimeMinutes: validated.runtimeMinutes,
      genre: validated.genre,
      director: validated.director,
      poster: validated.poster || null,
      source: 'custom',
      createdByUserId: userId,
    });

    // Create user-movie relationship
    // The effective_normalized_title will be automatically calculated by trigger
    await userMoviesRepo.create({
      userId,
      movieId: movie.id,
      isFavorite: false,
    });

    return movie;
  }

  /**
   * Update movie (custom movies globally, OMDB movies as user overrides)
   */
  async updateMovie(
    userId: string,
    movieId: string,
    data: UpdateMovieRequest
  ): Promise<{ movie: Movie; isOverride: boolean } | null> {
    const validated = updateMovieSchema.parse(data);
    const movie = await moviesRepo.findById(movieId);

    if (!movie) return null;

    // If it's a custom movie created by this user, update the movie itself
    if (movie.source === 'custom' && movie.createdByUserId === userId) {
      const updateData: UpdateMovieRequest & { normalizedTitle?: string } = { ...validated };

      if (validated.title) {
        updateData.normalizedTitle = normalizeTitle(validated.title);

        // Check for duplicate title in user's collection (exclude current movie)
        const existingUserMovie = await userMoviesRepo.findByUserAndEffectiveTitle(
          userId, 
          updateData.normalizedTitle
        );
        if (existingUserMovie && existingUserMovie.movieId !== movieId) {
          throw new Error('A movie with the same name already exists in your collection.');
        }
      }

      const updatedMovie = await moviesRepo.update(movieId, userId, updateData);
      if (!updatedMovie) return null;

      return { movie: updatedMovie, isOverride: false };
    }

    // For OMDB movies, check uniqueness of overridden title if provided
    if (validated.title) {
      const normalizedOverrideTitle = normalizeTitle(validated.title);
      const existingUserMovie = await userMoviesRepo.findByUserAndEffectiveTitle(
        userId, 
        normalizedOverrideTitle
      );
      if (existingUserMovie && existingUserMovie.movieId !== movieId) {
        throw new Error('A movie with the same name already exists in your collection.');
      }
    }

    // Otherwise, save as user overrides
    await userMoviesRepo.updateOverrides(userId, movieId, validated);

    // Return updated movie (we need to fetch it with merged data)
    return { movie, isOverride: true };
  }

  /**
   * Delete movie (custom movies globally, OMDB movies as user relationship)
   */
  async deleteMovie(userId: string, movieId: string): Promise<boolean> {
    logger.debug('MoviesService: Deleting movie', {
      userId,
      movieId
    });

    try {
      const movie = await moviesRepo.findById(movieId);
      
      logger.debug('MoviesService: Found movie', {
        userId,
        movieId,
        movie: movie ? { id: movie.id, source: movie.source, createdByUserId: movie.createdByUserId } : null
      });
      
      if (!movie) {
        logger.warn('MoviesService: Movie not found', {
          userId,
          movieId
        });
        return false;
      }

      // If it's a custom movie created by this user, delete the movie itself
      if (movie.source === 'custom' && movie.createdByUserId === userId) {
        logger.debug('MoviesService: Deleting custom movie globally', {
          userId,
          movieId
        });
        return moviesRepo.delete(movieId, userId);
      }

      // Otherwise, just remove the user-movie relationship
      logger.debug('MoviesService: Deleting user-movie relationship', {
        userId,
        movieId
      });
      return userMoviesRepo.delete(userId, movieId);
    } catch (error) {
      logger.error('MoviesService: Delete movie failed', {
        userId,
        movieId,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Set favorite status
   */
  async setFavorite(
    userId: string,
    movieId: string,
    isFavorite: boolean
  ): Promise<boolean> {
    logger.debug('MoviesService: Setting favorite status', {
      userId,
      movieId,
      isFavorite
    });

    // Ensure user-movie relationship exists
    const existing = await userMoviesRepo.findByUserAndMovie(userId, movieId);
    
    logger.debug('MoviesService: Existing relationship check', {
      userId,
      movieId,
      hasExisting: !!existing
    });

    if (existing) {
      logger.debug('MoviesService: Updating existing relationship');
      const result = await userMoviesRepo.setFavorite(
        userId,
        movieId,
        isFavorite
      );
      const success = result !== null;
      logger.debug('MoviesService: Update result', { success });
      return success;
    } else {
      logger.debug('MoviesService: Creating new relationship - checking movie exists');
      // Create relationship if it doesn't exist
      const movie = await moviesRepo.findById(movieId);
      if (!movie) {
        logger.warn('MoviesService: Movie not found for setFavorite', { movieId });
        return false;
      }

      logger.debug('MoviesService: Movie found, checking for duplicate titles', {
        movieTitle: movie.title
      });

      // Check if user already has movie with same title
      const normalizedTitle = normalizeTitle(movie.title);
      const existingUserMovie = await userMoviesRepo.findByUserAndEffectiveTitle(
        userId, 
        normalizedTitle
      );
      if (existingUserMovie) {
        logger.warn('MoviesService: Duplicate movie title found', {
          userId,
          normalizedTitle,
          existingMovieId: existingUserMovie.movieId
        });
        throw new Error('A movie with the same name already exists in your collection.');
      }

      logger.debug('MoviesService: Creating new user-movie relationship');
      await userMoviesRepo.create({
        userId,
        movieId,
        isFavorite,
      });
      
      logger.debug('MoviesService: New relationship created successfully');
      return true;
    }
  }

  /**
   * Get user's movies (with overrides applied)
   */
  async getUserMovies(userId: string, favoritesOnly: boolean = false) {
    return userMoviesRepo.getUserMovies(userId, favoritesOnly);
  }
}

export const moviesService = new MoviesService();
