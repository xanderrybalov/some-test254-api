import { Movie, MovieRow } from '../domain/types.js';
import db from '../db/index.js';

export class MoviesRepository {
  /**
   * Find movie by ID
   */
  async findById(id: string): Promise<Movie | null> {
    const result = await db.query<MovieRow>(
      'SELECT * FROM movies WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToMovie(result.rows[0]!);
  }

  /**
   * Find movie by OMDB ID
   */
  async findByOmdbId(omdbId: string): Promise<Movie | null> {
    const result = await db.query<MovieRow>(
      'SELECT * FROM movies WHERE omdb_id = $1',
      [omdbId]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToMovie(result.rows[0]!);
  }

  /**
   * Find movie by normalized title
   */
  async findByNormalizedTitle(normalizedTitle: string): Promise<Movie | null> {
    const result = await db.query<MovieRow>(
      'SELECT * FROM movies WHERE lower(normalized_title) = lower($1)',
      [normalizedTitle]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToMovie(result.rows[0]!);
  }

  /**
   * Get multiple movies by IDs
   */
  async findByIds(ids: string[]): Promise<Movie[]> {
    if (ids.length === 0) return [];

    const result = await db.query<MovieRow>(
      'SELECT * FROM movies WHERE id = ANY($1)',
      [ids]
    );

    return result.rows.map(row => this.mapRowToMovie(row));
  }

  /**
   * Create new movie
   */
  async create(movieData: {
    title: string;
    normalizedTitle: string;
    year?: number | null;
    runtimeMinutes?: number | null;
    genre?: string[] | null;
    director?: string[] | null;
    source: 'omdb' | 'custom';
    omdbId?: string | null;
    createdByUserId?: string | null;
  }): Promise<Movie> {
    const result = await db.query<MovieRow>(
      `
      INSERT INTO movies (
        title, normalized_title, year, runtime_minutes, genre, director, 
        source, omdb_id, created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        movieData.title,
        movieData.normalizedTitle,
        movieData.year ?? null,
        movieData.runtimeMinutes ?? null,
        movieData.genre ?? null,
        movieData.director ?? null,
        movieData.source,
        movieData.omdbId ?? null,
        movieData.createdByUserId ?? null,
      ]
    );

    return this.mapRowToMovie(result.rows[0]!);
  }

  /**
   * Update movie (only for custom movies owned by user)
   */
  async update(
    movieId: string,
    userId: string,
    movieData: {
      title?: string;
      normalizedTitle?: string;
      year?: number | null;
      runtimeMinutes?: number | null;
      genre?: string[] | null;
      director?: string[] | null;
    }
  ): Promise<Movie | null> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (movieData.title !== undefined) {
      setParts.push(`title = $${paramIndex}`);
      values.push(movieData.title);
      paramIndex++;
    }

    if (movieData.normalizedTitle !== undefined) {
      setParts.push(`normalized_title = $${paramIndex}`);
      values.push(movieData.normalizedTitle);
      paramIndex++;
    }

    if (movieData.year !== undefined) {
      setParts.push(`year = $${paramIndex}`);
      values.push(movieData.year);
      paramIndex++;
    }

    if (movieData.runtimeMinutes !== undefined) {
      setParts.push(`runtime_minutes = $${paramIndex}`);
      values.push(movieData.runtimeMinutes);
      paramIndex++;
    }

    if (movieData.genre !== undefined) {
      setParts.push(`genre = $${paramIndex}`);
      values.push(movieData.genre);
      paramIndex++;
    }

    if (movieData.director !== undefined) {
      setParts.push(`director = $${paramIndex}`);
      values.push(movieData.director);
      paramIndex++;
    }

    if (setParts.length === 0) {
      // No fields to update, return current movie
      return this.findById(movieId);
    }

    setParts.push(`updated_at = now()`);
    values.push(movieId, userId);

    const query = `
      UPDATE movies 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex} 
        AND source = 'custom' 
        AND created_by_user_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await db.query<MovieRow>(query, values);

    if (result.rows.length === 0) return null;

    return this.mapRowToMovie(result.rows[0]!);
  }

  /**
   * Delete movie (only custom movies owned by user)
   */
  async delete(movieId: string, userId: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM movies WHERE id = $1 AND source = $2 AND created_by_user_id = $3',
      [movieId, 'custom', userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Upsert movie from OMDB (for caching)
   */
  async upsertFromOmdb(movieData: {
    omdbId: string;
    title: string;
    normalizedTitle: string;
    year: number | null;
    runtimeMinutes: number | null;
    genre: string[] | null;
    director: string[] | null;
  }): Promise<Movie> {
    const result = await db.query<MovieRow>(
      `
      INSERT INTO movies (
        omdb_id, title, normalized_title, year, runtime_minutes, genre, director, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'omdb')
      ON CONFLICT (omdb_id) 
      DO UPDATE SET
        title = EXCLUDED.title,
        normalized_title = EXCLUDED.normalized_title,
        year = EXCLUDED.year,
        runtime_minutes = EXCLUDED.runtime_minutes,
        genre = EXCLUDED.genre,
        director = EXCLUDED.director,
        updated_at = now()
      RETURNING *
    `,
      [
        movieData.omdbId,
        movieData.title,
        movieData.normalizedTitle,
        movieData.year,
        movieData.runtimeMinutes,
        movieData.genre,
        movieData.director,
      ]
    );

    return this.mapRowToMovie(result.rows[0]!);
  }

  private mapRowToMovie(row: MovieRow): Movie {
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
  }
}

export const moviesRepo = new MoviesRepository();
