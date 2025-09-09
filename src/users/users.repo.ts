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
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await db.query<UserRow>(
      'SELECT * FROM users WHERE lower(email) = lower($1)',
      [email]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToUser(result.rows[0]!);
  }

  /**
   * Find user by username or email (for login)
   */
  async findByUsernameOrEmail(login: string): Promise<(User & { passwordHash?: string }) | null> {
    const result = await db.query<UserRow>(
      `SELECT * FROM users 
       WHERE lower(username) = lower($1) 
       OR lower(email) = lower($1)`,
      [login]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0]!;
    return {
      ...this.mapRowToUser(row),
      passwordHash: row.password_hash || undefined,
    };
  }

  /**
   * Create user with password (for registration)
   */
  async createWithPassword(data: {
    username: string;
    email: string | null;
    passwordHash: string;
  }): Promise<User> {
    const result = await db.query<UserRow>(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [data.username, data.email, data.passwordHash]
    );

    return this.mapRowToUser(result.rows[0]!);
  }

  private mapRowToUser(row: UserRow): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email || undefined,
      createdAt: row.created_at,
    };
  }
}

export const usersRepo = new UsersRepository();
