import { fetch } from 'undici';
import { env } from '../config/env.js';
import logger from '../config/logger.js';
import {
  OMDBSearchResponse,
  OMDBMovieDetails,
  Movie,
} from '../domain/types.js';
import {
  normalizeTitle,
  parseRuntime,
  parseYear,
  parseList,
} from '../domain/normalize.js';
import db from '../db/index.js';

export class OMDBService {
  private readonly baseUrl = 'https://www.omdbapi.com/';
  private readonly timeout = 5000; // 5 seconds
  private readonly maxRetries = 2;

  /**
   * Search movies in OMDB API
   */
  async searchMovies(
    query: string,
    page: number = 1
  ): Promise<{
    items: Movie[];
    total: number;
  }> {
    logger.debug('Searching movies in OMDB', { query, page });

    const searchResponse = await this.fetchWithRetry<OMDBSearchResponse>(
      `${this.baseUrl}?apikey=${env.OMDB_API_KEY}&s=${encodeURIComponent(query)}&page=${page}`
    );

    if (searchResponse.Response === 'False') {
      logger.debug('OMDB search returned no results', {
        query,
        error: searchResponse.Error,
      });
      return { items: [], total: 0 };
    }

    // Get detailed info for each movie and cache in database
    const moviePromises = searchResponse.Search.map(item =>
      this.getMovieDetailsAndCache(item.imdbID)
    );

    const movies = await Promise.allSettled(moviePromises);
    const validMovies = movies
      .filter(
        (result): result is PromiseFulfilledResult<Movie | null> =>
          result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value!);

    return {
      items: validMovies,
      total: parseInt(searchResponse.totalResults, 10) || 0,
    };
  }

  /**
   * Get movie details from OMDB and cache/update in database
   */
  async getMovieDetailsAndCache(imdbId: string): Promise<Movie | null> {
    try {
      // Check if movie exists in cache and is fresh
      const cachedMovie = await this.getCachedMovie(imdbId);
      if (cachedMovie && this.isCacheFresh(cachedMovie.updatedAt)) {
        logger.debug('Using cached movie', { imdbId });
        return cachedMovie;
      }

      // Fetch from OMDB
      const details = await this.fetchWithRetry<OMDBMovieDetails>(
        `${this.baseUrl}?apikey=${env.OMDB_API_KEY}&i=${imdbId}&plot=short`
      );

      if (details.Response === 'False') {
        logger.warn('OMDB movie details not found', {
          imdbId,
          error: details.Error,
        });
        return null;
      }

      // Convert OMDB response to our format
      const movieData = this.convertOMDBToMovie(details);

      // Cache in database and get full movie object back
      await this.cacheMovie(movieData);

      // Fetch the cached movie to get the full object with id, createdAt, updatedAt
      return this.getCachedMovie(imdbId);
    } catch (error) {
      logger.error('Failed to get movie details', { imdbId, error });
      return null;
    }
  }

  /**
   * Get cached movie from database
   */
  private async getCachedMovie(omdbId: string): Promise<Movie | null> {
    try {
      const result = await db.query<any>(
        'SELECT * FROM movies WHERE omdb_id = $1',
        [omdbId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        omdbId: row.omdb_id,
        title: row.title,
        normalizedTitle: row.normalized_title,
        year: row.year,
        runtimeMinutes: row.runtime_minutes,
        genre: row.genre,
        director: row.director,
        source: row.source,
        createdByUserId: row.created_by_user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get cached movie', { omdbId, error });
      return null;
    }
  }

  /**
   * Cache movie in database (upsert)
   */
  private async cacheMovie(
    movie: Omit<Movie, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    try {
      await db.query(
        `
        INSERT INTO movies (omdb_id, title, normalized_title, year, runtime_minutes, genre, director, source, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (omdb_id) 
        DO UPDATE SET
          title = EXCLUDED.title,
          normalized_title = EXCLUDED.normalized_title,
          year = EXCLUDED.year,
          runtime_minutes = EXCLUDED.runtime_minutes,
          genre = EXCLUDED.genre,
          director = EXCLUDED.director,
          updated_at = now()
      `,
        [
          movie.omdbId,
          movie.title,
          movie.normalizedTitle,
          movie.year,
          movie.runtimeMinutes,
          movie.genre,
          movie.director,
          movie.source,
          movie.createdByUserId,
        ]
      );
    } catch (error) {
      logger.error('Failed to cache movie', { movie, error });
    }
  }

  /**
   * Check if cached movie is fresh (within TTL)
   */
  private isCacheFresh(updatedAt: Date): boolean {
    const ttlMs = env.CACHE_TTL_HOURS * 60 * 60 * 1000;
    return Date.now() - updatedAt.getTime() < ttlMs;
  }

  /**
   * Convert OMDB response to our Movie format
   */
  private convertOMDBToMovie(
    omdbMovie: OMDBMovieDetails
  ): Omit<Movie, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      omdbId: omdbMovie.imdbID,
      title: omdbMovie.Title,
      normalizedTitle: normalizeTitle(omdbMovie.Title),
      year: parseYear(omdbMovie.Year),
      runtimeMinutes: parseRuntime(omdbMovie.Runtime),
      genre: parseList(omdbMovie.Genre),
      director: parseList(omdbMovie.Director),
      source: 'omdb' as const,
      createdByUserId: null,
    };
  }

  /**
   * Fetch with retry logic and exponential backoff
   */
  private async fetchWithRetry<T>(
    url: string,
    retryCount: number = 0
  ): Promise<T> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Movies-API/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      logger.warn(`OMDB API request failed (attempt ${retryCount + 1})`, {
        url,
        error,
      });

      if (retryCount < this.maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, retryCount + 1);
      }

      throw error;
    }
  }
}

export const omdbService = new OMDBService();
