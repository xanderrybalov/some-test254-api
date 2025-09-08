import { z } from 'zod';
import { Movie, CreateMovieRequest, UpdateMovieRequest } from '../domain/types.js';
import { normalizeTitle } from '../domain/normalize.js';
import { moviesRepo } from './movies.repo.js';
import { userMoviesRepo } from '../userMovies/userMovies.repo.js';
import { omdbService } from '../omdb/omdb.service.js';

const createMovieSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').trim(),
  year: z.number().int().min(1888).max(2100),
  runtimeMinutes: z.number().int().min(1),
  genre: z.array(z.string().min(3)).min(1, 'At least one genre is required'),
  director: z.array(z.string().min(3)).min(1, 'At least one director is required'),
});

const updateMovieSchema = z.object({
  title: z.string().min(3).trim().optional(),
  year: z.number().int().min(1888).max(2100).optional(),
  runtimeMinutes: z.number().int().min(1).optional(),
  genre: z.array(z.string().min(3)).min(1).optional(),
  director: z.array(z.string().min(3)).min(1).optional(),
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
  async createCustomMovie(userId: string, data: CreateMovieRequest): Promise<Movie> {
    const validated = createMovieSchema.parse(data);
    const normalizedTitle = normalizeTitle(validated.title);

    // Check for duplicate title
    const existingMovie = await moviesRepo.findByNormalizedTitle(normalizedTitle);
    if (existingMovie) {
      throw new Error('A movie with the same name already exists.');
    }

    // Create movie
    const movie = await moviesRepo.create({
      title: validated.title,
      normalizedTitle,
      year: validated.year,
      runtimeMinutes: validated.runtimeMinutes,
      genre: validated.genre,
      director: validated.director,
      source: 'custom',
      createdByUserId: userId,
    });

    // Create user-movie relationship
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
      const updateData: any = { ...validated };
      
      if (validated.title) {
        updateData.normalizedTitle = normalizeTitle(validated.title);
        
        // Check for duplicate title (exclude current movie)
        const existingMovie = await moviesRepo.findByNormalizedTitle(updateData.normalizedTitle);
        if (existingMovie && existingMovie.id !== movieId) {
          throw new Error('A movie with the same name already exists.');
        }
      }

      const updatedMovie = await moviesRepo.update(movieId, userId, updateData);
      if (!updatedMovie) return null;

      return { movie: updatedMovie, isOverride: false };
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
    const movie = await moviesRepo.findById(movieId);
    if (!movie) return false;

    // If it's a custom movie created by this user, delete the movie itself
    if (movie.source === 'custom' && movie.createdByUserId === userId) {
      return moviesRepo.delete(movieId, userId);
    }

    // Otherwise, just remove the user-movie relationship
    return userMoviesRepo.delete(userId, movieId);
  }

  /**
   * Set favorite status
   */
  async setFavorite(
    userId: string,
    movieId: string,
    isFavorite: boolean
  ): Promise<boolean> {
    // Ensure user-movie relationship exists
    const existing = await userMoviesRepo.findByUserAndMovie(userId, movieId);
    
    if (existing) {
      const result = await userMoviesRepo.setFavorite(userId, movieId, isFavorite);
      return result !== null;
    } else {
      // Create relationship if it doesn't exist
      const movie = await moviesRepo.findById(movieId);
      if (!movie) return false;

      await userMoviesRepo.create({
        userId,
        movieId,
        isFavorite,
      });
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
