import { User, UserRow } from '../domain/types.js';
import db from '../db/index.js';

export class UsersRepository {
  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const result = await db.query<UserRow>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToUser(result.rows[0]!);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const result = await db.query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToUser(result.rows[0]!);
  }

  /**
   * Create new user
   */
  async create(username: string): Promise<User> {
    const result = await db.query<UserRow>(
      'INSERT INTO users (username) VALUES ($1) RETURNING *',
      [username]
    );

    return this.mapRowToUser(result.rows[0]!);
  }

  /**
   * Upsert user (find or create)
   */
  async upsert(username: string): Promise<User> {
    const result = await db.query<UserRow>(`
      INSERT INTO users (username) 
      VALUES ($1) 
      ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
      RETURNING *
    `, [username]);

    return this.mapRowToUser(result.rows[0]!);
  }

  private mapRowToUser(row: UserRow): User {
    return {
      id: row.id,
      username: row.username,
      createdAt: row.created_at,
    };
  }
}

export const usersRepo = new UsersRepository();
