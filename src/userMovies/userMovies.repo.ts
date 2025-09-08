import { UserMovie, UserMovieRow, MovieWithUserData } from '../domain/types.js';
import db from '../db/index.js';

export class UserMoviesRepository {
  /**
   * Find user-movie relationship
   */
  async findByUserAndMovie(
    userId: string,
    movieId: string
  ): Promise<UserMovie | null> {
    const result = await db.query<UserMovieRow>(
      'SELECT * FROM user_movies WHERE user_id = $1 AND movie_id = $2',
      [userId, movieId]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToUserMovie(result.rows[0]!);
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

    const result = await db.query<any>(
      `
      SELECT 
        m.id,
        COALESCE(um.overridden_title, m.title) as title,
        COALESCE(um.overridden_year, m.year) as year,
        COALESCE(um.overridden_runtime_minutes, m.runtime_minutes) as runtime_minutes,
        COALESCE(um.overridden_genre, m.genre) as genre,
        COALESCE(um.overridden_director, m.director) as director,
        um.is_favorite,
        um.overridden_title,
        um.overridden_year,
        um.overridden_runtime_minutes,
        um.overridden_genre,
        um.overridden_director,
        m.source
      FROM user_movies um
      JOIN movies m ON um.movie_id = m.id
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
      isFavorite: row.is_favorite,
      overrides: {
        title: row.overridden_title,
        year: row.overridden_year,
        runtimeMinutes: row.overridden_runtime_minutes,
        genre: row.overridden_genre,
        director: row.overridden_director,
      },
      source: row.source,
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
    const result = await db.query<UserMovieRow>(
      `
      INSERT INTO user_movies (user_id, movie_id, is_favorite)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
      [data.userId, data.movieId, data.isFavorite ?? false]
    );

    return this.mapRowToUserMovie(result.rows[0]!);
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
    }
  ): Promise<UserMovie | null> {
    const setParts: string[] = [];
    const values: any[] = [];
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
    const result = await db.query<UserMovieRow>(
      `
      UPDATE user_movies 
      SET is_favorite = $3, updated_at = now()
      WHERE user_id = $1 AND movie_id = $2
      RETURNING *
    `,
      [userId, movieId, isFavorite]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToUserMovie(result.rows[0]!);
  }

  /**
   * Create or update user-movie relationship
   */
  async upsert(data: {
    userId: string;
    movieId: string;
    isFavorite?: boolean;
  }): Promise<UserMovie> {
    const result = await db.query<UserMovieRow>(
      `
      INSERT INTO user_movies (user_id, movie_id, is_favorite)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, movie_id) 
      DO UPDATE SET 
        is_favorite = EXCLUDED.is_favorite,
        updated_at = now()
      RETURNING *
    `,
      [data.userId, data.movieId, data.isFavorite ?? false]
    );

    return this.mapRowToUserMovie(result.rows[0]!);
  }

  /**
   * Delete user-movie relationship
   */
  async delete(userId: string, movieId: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM user_movies WHERE user_id = $1 AND movie_id = $2',
      [userId, movieId]
    );

    return (result.rowCount ?? 0) > 0;
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
}

export const userMoviesRepo = new UserMoviesRepository();
