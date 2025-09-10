import { UserMovie, UserMovieRow, MovieWithUserData } from '../domain/types.js';
import db from '../db/index.js';
import logger from '../config/logger.js';

export class UserMoviesRepository {
  /**
   * Find user-movie relationship
   */
  async findByUserAndMovie(
    userId: string,
    movieId: string
  ): Promise<UserMovie | null> {
    logger.debug('UserMoviesRepo: Finding user-movie relationship', {
      userId,
      movieId
    });

    try {
      const result = await db.query<UserMovieRow>(
        'SELECT * FROM user_movies WHERE user_id = $1 AND movie_id = $2',
        [userId, movieId]
      );

      logger.debug('UserMoviesRepo: FindByUserAndMovie result', {
        userId,
        movieId,
        found: result.rows.length > 0,
        rowCount: result.rowCount
      });

      if (result.rows.length === 0) return null;

      return this.mapRowToUserMovie(result.rows[0]!);
    } catch (error) {
      logger.error('UserMoviesRepo: FindByUserAndMovie failed', {
        userId,
        movieId,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's movies with merged data (movie + user overrides)
   */
  async getUserMovies(
    userId: string,
    favoritesOnly: boolean = false
  ): Promise<MovieWithUserData[]> {
    const whereClause = favoritesOnly
      ? 'WHERE um.user_id = $1 AND um.is_favorite = true'
      : 'WHERE um.user_id = $1';

    const result = await db.query<{
      id: string;
      title: string;
      year: number | null;
      runtime_minutes: number | null;
      genre: string[] | null;
      director: string[] | null;
      poster: string | null;
      is_favorite: boolean;
      overridden_title: string | null;
      overridden_year: number | null;
      overridden_runtime_minutes: number | null;
      overridden_genre: string[] | null;
      overridden_director: string[] | null;
      source: string;
    }>(
      `
      SELECT 
        m.id,
        COALESCE(um.overridden_title, m.title) as title,
        COALESCE(um.overridden_year, m.year) as year,
        COALESCE(um.overridden_runtime_minutes, m.runtime_minutes) as runtime_minutes,
        COALESCE(um.overridden_genre, m.genre) as genre,
        COALESCE(um.overridden_director, m.director) as director,
        m.poster,
        um.is_favorite,
        um.overridden_title,
        um.overridden_year,
        um.overridden_runtime_minutes,
        um.overridden_genre,
        um.overridden_director,
        m.source
      FROM user_movies um
      JOIN movies m ON um.movie_id = m.id AND m.is_deleted = false
      ${whereClause}
      ORDER BY um.updated_at DESC
    `,
      favoritesOnly ? [userId] : [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      year: row.year,
      runtimeMinutes: row.runtime_minutes,
      genre: row.genre,
      director: row.director,
      poster: row.poster,
      isFavorite: row.is_favorite,
      overrides: {
        title: row.overridden_title,
        year: row.overridden_year,
        runtimeMinutes: row.overridden_runtime_minutes,
        genre: row.overridden_genre,
        director: row.overridden_director,
      },
      source: row.source as 'omdb' | 'custom',
    }));
  }

  /**
   * Create user-movie relationship
   */
  async create(data: {
    userId: string;
    movieId: string;
    isFavorite?: boolean;
  }): Promise<UserMovie> {
    logger.debug('UserMoviesRepo: Creating user-movie relationship', {
      userId: data.userId,
      movieId: data.movieId,
      isFavorite: data.isFavorite ?? false
    });

    try {
      // First get the movie title to calculate effective_normalized_title
      logger.debug('UserMoviesRepo: Getting movie title for effective_normalized_title');
      const movieResult = await db.query(
        'SELECT title FROM movies WHERE id = $1',
        [data.movieId]
      );

      if (movieResult.rows.length === 0) {
        throw new Error(`Movie with id ${data.movieId} not found`);
      }

      const movieTitle = movieResult.rows[0]!.title;
      const effectiveNormalizedTitle = movieTitle
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      logger.debug('UserMoviesRepo: Calculated effective_normalized_title', {
        originalTitle: movieTitle,
        effectiveNormalizedTitle
      });

      // Try to insert with effective_normalized_title
      const query = `
        INSERT INTO user_movies (user_id, movie_id, is_favorite, effective_normalized_title)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const params = [data.userId, data.movieId, data.isFavorite ?? false, effectiveNormalizedTitle];

      logger.debug('UserMoviesRepo: Executing create query', {
        query,
        params
      });

      const result = await db.query<UserMovieRow>(query, params);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Insert returned no rows');
      }

      logger.debug('UserMoviesRepo: User-movie relationship created successfully', {
        userId: data.userId,
        movieId: data.movieId
      });

      return this.mapRowToUserMovie(result.rows[0]!);
    } catch (error) {
      logger.error('UserMoviesRepo: Failed to create user-movie relationship', {
        userId: data.userId,
        movieId: data.movieId,
        isFavorite: data.isFavorite,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof Error && 'code' in error ? error.code : undefined
      });

      // If the error is about missing effective_normalized_title column, try fallback
      if (error instanceof Error && error.message.includes('effective_normalized_title')) {
        logger.warn('UserMoviesRepo: effective_normalized_title column missing, using fallback INSERT');
        
        try {
          const fallbackQuery = `
            INSERT INTO user_movies (user_id, movie_id, is_favorite)
            VALUES ($1, $2, $3)
            RETURNING *
          `;
          const fallbackParams = [data.userId, data.movieId, data.isFavorite ?? false];
          
          logger.debug('UserMoviesRepo: Using fallback create query', {
            query: fallbackQuery,
            params: fallbackParams
          });
          
          const fallbackResult = await db.query<UserMovieRow>(fallbackQuery, fallbackParams);
          
          if (!fallbackResult.rows || fallbackResult.rows.length === 0) {
            throw new Error('Fallback insert returned no rows');
          }
          
          logger.info('UserMoviesRepo: Fallback create successful');
          
          return this.mapRowToUserMovie(fallbackResult.rows[0]!);
        } catch (fallbackError) {
          logger.error('UserMoviesRepo: Fallback create also failed', {
            fallbackError,
            originalError: error
          });
          throw error; // Throw original error
        }
      }
      
      throw error;
    }
  }

  /**
   * Update user-movie overrides
   */
  async updateOverrides(
    userId: string,
    movieId: string,
    overrides: {
      title?: string | null;
      year?: number | null;
      runtimeMinutes?: number | null;
      genre?: string[] | null;
      director?: string[] | null;
      // poster is immutable - cannot be overridden
    }
  ): Promise<UserMovie | null> {
    const setParts: string[] = [];
    const values: (string | number | string[] | null)[] = [];
    let paramIndex = 1;

    if (overrides.title !== undefined) {
      setParts.push(`overridden_title = $${paramIndex}`);
      values.push(overrides.title);
      paramIndex++;
    }

    if (overrides.year !== undefined) {
      setParts.push(`overridden_year = $${paramIndex}`);
      values.push(overrides.year);
      paramIndex++;
    }

    if (overrides.runtimeMinutes !== undefined) {
      setParts.push(`overridden_runtime_minutes = $${paramIndex}`);
      values.push(overrides.runtimeMinutes);
      paramIndex++;
    }

    if (overrides.genre !== undefined) {
      setParts.push(`overridden_genre = $${paramIndex}`);
      values.push(overrides.genre);
      paramIndex++;
    }

    if (overrides.director !== undefined) {
      setParts.push(`overridden_director = $${paramIndex}`);
      values.push(overrides.director);
      paramIndex++;
    }

    if (setParts.length === 0) {
      return this.findByUserAndMovie(userId, movieId);
    }

    setParts.push(`updated_at = now()`);
    values.push(userId, movieId);

    const query = `
      UPDATE user_movies 
      SET ${setParts.join(', ')}
      WHERE user_id = $${paramIndex} AND movie_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await db.query<UserMovieRow>(query, values);

    if (result.rows.length === 0) return null;

    return this.mapRowToUserMovie(result.rows[0]!);
  }

  /**
   * Set favorite status
   */
  async setFavorite(
    userId: string,
    movieId: string,
    isFavorite: boolean
  ): Promise<UserMovie | null> {
    logger.debug('UserMoviesRepo: Setting favorite status', {
      userId,
      movieId,
      isFavorite
    });

    try {
      const query = `
        UPDATE user_movies 
        SET is_favorite = $3, updated_at = now()
        WHERE user_id = $1 AND movie_id = $2
        RETURNING *
      `;
      const params = [userId, movieId, isFavorite];
      
      logger.debug('UserMoviesRepo: Executing setFavorite query', {
        query,
        params
      });

      const result = await db.query<UserMovieRow>(query, params);
      
      logger.debug('UserMoviesRepo: SetFavorite query result', {
        rowCount: result.rowCount,
        hasRows: result.rows.length > 0
      });

      if (result.rows.length === 0) {
        logger.warn('UserMoviesRepo: No rows updated in setFavorite - relationship may not exist', {
          userId,
          movieId
        });
        return null;
      }

      const userMovie = this.mapRowToUserMovie(result.rows[0]!);
      logger.debug('UserMoviesRepo: SetFavorite successful', {
        userId,
        movieId,
        isFavorite: userMovie.isFavorite
      });

      return userMovie;
    } catch (error) {
      logger.error('UserMoviesRepo: SetFavorite failed', {
        userId,
        movieId,
        isFavorite,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create or update user-movie relationship
   */
  async upsert(data: {
    userId: string;
    movieId: string;
    isFavorite?: boolean;
  }): Promise<UserMovie> {
    logger.debug('UserMoviesRepo: Upserting user-movie relationship', {
      userId: data.userId,
      movieId: data.movieId,
      isFavorite: data.isFavorite ?? false
    });

    try {
      // First get the movie title for effective_normalized_title
      const movieResult = await db.query(
        'SELECT title FROM movies WHERE id = $1',
        [data.movieId]
      );

      if (movieResult.rows.length === 0) {
        throw new Error(`Movie with id ${data.movieId} not found`);
      }

      const movieTitle = movieResult.rows[0]!.title;
      const effectiveNormalizedTitle = movieTitle
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      logger.debug('UserMoviesRepo: Using effective_normalized_title for upsert', {
        originalTitle: movieTitle,
        effectiveNormalizedTitle
      });

      // Try to upsert with effective_normalized_title
      const query = `
        INSERT INTO user_movies (user_id, movie_id, is_favorite, effective_normalized_title)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, movie_id) 
        DO UPDATE SET 
          is_favorite = EXCLUDED.is_favorite,
          effective_normalized_title = EXCLUDED.effective_normalized_title,
          updated_at = now()
        RETURNING *
      `;
      const params = [data.userId, data.movieId, data.isFavorite ?? false, effectiveNormalizedTitle];

      logger.debug('UserMoviesRepo: Executing upsert query', {
        query,
        params
      });

      const result = await db.query<UserMovieRow>(query, params);

      logger.debug('UserMoviesRepo: Upsert successful');

      return this.mapRowToUserMovie(result.rows[0]!);
    } catch (error) {
      logger.error('UserMoviesRepo: Upsert failed', {
        userId: data.userId,
        movieId: data.movieId,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      // If the error is about missing effective_normalized_title column, try fallback
      if (error instanceof Error && error.message.includes('effective_normalized_title')) {
        logger.warn('UserMoviesRepo: effective_normalized_title column missing, using fallback upsert');
        
        try {
          const fallbackQuery = `
            INSERT INTO user_movies (user_id, movie_id, is_favorite)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, movie_id) 
            DO UPDATE SET 
              is_favorite = EXCLUDED.is_favorite,
              updated_at = now()
            RETURNING *
          `;
          const fallbackParams = [data.userId, data.movieId, data.isFavorite ?? false];
          
          logger.debug('UserMoviesRepo: Using fallback upsert query', {
            query: fallbackQuery,
            params: fallbackParams
          });
          
          const fallbackResult = await db.query<UserMovieRow>(fallbackQuery, fallbackParams);
          
          logger.info('UserMoviesRepo: Fallback upsert successful');
          
          return this.mapRowToUserMovie(fallbackResult.rows[0]!);
        } catch (fallbackError) {
          logger.error('UserMoviesRepo: Fallback upsert also failed', {
            fallbackError,
            originalError: error
          });
          throw error; // Throw original error
        }
      }
      
      throw error;
    }
  }

  /**
   * Delete user-movie relationship
   */
  async delete(userId: string, movieId: string): Promise<boolean> {
    logger.debug('UserMoviesRepo: Deleting user-movie relationship', {
      userId,
      movieId
    });

    try {
      const query = 'DELETE FROM user_movies WHERE user_id = $1 AND movie_id = $2';
      const params = [userId, movieId];

      logger.debug('UserMoviesRepo: Executing delete query', {
        query,
        params
      });

      const result = await db.query(query, params);

      const success = (result.rowCount ?? 0) > 0;

      logger.debug('UserMoviesRepo: Delete result', {
        userId,
        movieId,
        rowCount: result.rowCount,
        success
      });

      return success;
    } catch (error) {
      logger.error('UserMoviesRepo: Delete failed', {
        userId,
        movieId,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof Error && 'code' in error ? error.code : undefined
      });
      throw error;
    }
  }

  private mapRowToUserMovie(row: UserMovieRow): UserMovie {
    return {
      userId: row.user_id,
      movieId: row.movie_id,
      isFavorite: row.is_favorite,
      overriddenTitle: row.overridden_title,
      overriddenYear: row.overridden_year,
      overriddenRuntimeMinutes: row.overridden_runtime_minutes,
      overriddenGenre: row.overridden_genre,
      overriddenDirector: row.overridden_director,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Check if user already has movie with the same effective normalized title
   */
  async findByUserAndEffectiveTitle(
    userId: string,
    effectiveNormalizedTitle: string
  ): Promise<UserMovie | null> {
    logger.debug('UserMoviesRepo: Finding by effective title', {
      userId,
      effectiveNormalizedTitle
    });

    try {
      const query = 'SELECT * FROM user_movies WHERE user_id = $1 AND LOWER(effective_normalized_title) = LOWER($2)';
      const params = [userId, effectiveNormalizedTitle];

      logger.debug('UserMoviesRepo: Executing findByUserAndEffectiveTitle query', {
        query,
        params
      });

      const result = await db.query<UserMovieRow>(query, params);
      
      logger.debug('UserMoviesRepo: FindByUserAndEffectiveTitle result', {
        found: result.rows.length > 0,
        rowCount: result.rowCount
      });

      if (result.rows.length === 0) return null;

      return this.mapRowToUserMovie(result.rows[0]!);
    } catch (error) {
      logger.error('UserMoviesRepo: FindByUserAndEffectiveTitle failed', {
        userId,
        effectiveNormalizedTitle,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof Error && 'code' in error ? error.code : undefined
      });

      // If the error is about missing column, try fallback approach
      if (error instanceof Error && error.message.includes('effective_normalized_title')) {
        logger.warn('UserMoviesRepo: effective_normalized_title column missing, using fallback query');
        
        try {
          // Fallback: check by comparing titles directly with movies table
          const fallbackQuery = `
            SELECT um.* 
            FROM user_movies um
            JOIN movies m ON um.movie_id = m.id
            WHERE um.user_id = $1 
            AND (
              LOWER(TRIM(REGEXP_REPLACE(COALESCE(um.overridden_title, m.title), '[^\\w\\s]', '', 'g'))) = LOWER($2)
              OR LOWER(TRIM(REGEXP_REPLACE(m.title, '[^\\w\\s]', '', 'g'))) = LOWER($2)
            )
          `;
          
          logger.debug('UserMoviesRepo: Using fallback query', {
            query: fallbackQuery,
            params: [userId, effectiveNormalizedTitle]
          });
          
          const fallbackResult = await db.query<UserMovieRow>(fallbackQuery, [userId, effectiveNormalizedTitle]);
          
          logger.info('UserMoviesRepo: Fallback query successful', {
            found: fallbackResult.rows.length > 0
          });
          
          if (fallbackResult.rows.length === 0) return null;
          
          return this.mapRowToUserMovie(fallbackResult.rows[0]!);
        } catch (fallbackError) {
          logger.error('UserMoviesRepo: Fallback query also failed', {
            fallbackError,
            originalError: error
          });
          throw error; // Throw original error
        }
      }
      
      throw error;
    }
  }
}

export const userMoviesRepo = new UserMoviesRepository();
