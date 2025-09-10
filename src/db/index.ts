import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

export class Database {
  private pool: Pool;

  constructor() {
    // Log database connection details (without sensitive info)
    const dbUrl = new URL(env.DATABASE_URL);
    logger.info('Initializing database connection', {
      host: dbUrl.hostname,
      port: dbUrl.port,
      database: dbUrl.pathname.slice(1),
      user: dbUrl.username,
    });

    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', err => {
      logger.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', () => {
      logger.info('New database client connected');
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    try {
      const res = await this.pool.query<T>(text, params);
      return res;
    } catch (error) {
      logger.error('Database query error', { text, error });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Check database connection and basic info
   */
  async checkConnection(): Promise<any> {
    try {
      const result = await this.query('SELECT version(), current_database(), current_user, now()');
      const info = result.rows[0];
      logger.info('Database connection check successful', info);
      return info;
    } catch (error) {
      logger.error('Database connection check failed', { error });
      throw error;
    }
  }

  /**
   * Check if required tables exist
   */
  async checkTables(): Promise<{ [key: string]: boolean }> {
    try {
      const result = await this.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);
      
      const existingTables = result.rows.map(row => row.table_name);
      const requiredTables = ['users', 'movies', 'user_movies', 'pgmigrations'];
      
      const tableStatus = requiredTables.reduce((acc, table) => {
        acc[table] = existingTables.includes(table);
        return acc;
      }, {} as { [key: string]: boolean });

      logger.info('Database table check', { 
        existing: existingTables,
        required: requiredTables,
        status: tableStatus
      });

      return tableStatus;
    } catch (error) {
      logger.error('Database table check failed', { error });
      throw error;
    }
  }

  /**
   * Check users table structure
   */
  async checkUsersTableStructure(): Promise<any> {
    try {
      const result = await this.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows;
      logger.info('Users table structure', { columns });
      
      // Check for required authentication columns
      const hasEmail = columns.some(col => col.column_name === 'email');
      const hasPasswordHash = columns.some(col => col.column_name === 'password_hash');
      
      logger.info('Users table authentication fields', {
        hasEmail,
        hasPasswordHash,
        missingFields: [
          !hasEmail && 'email',
          !hasPasswordHash && 'password_hash'
        ].filter(Boolean)
      });

      return { columns, hasEmail, hasPasswordHash };
    } catch (error) {
      logger.error('Users table structure check failed', { error });
      throw error;
    }
  }

  /**
   * Check migration status
   */
  async checkMigrations(): Promise<any> {
    try {
      const result = await this.query(`
        SELECT name, run_on 
        FROM pgmigrations 
        ORDER BY run_on DESC
      `);
      
      const migrations = result.rows;
      logger.info('Applied migrations', { migrations });
      
      return migrations;
    } catch (error) {
      logger.warn('Could not check migrations table', { error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }

  /**
   * Create basic schema as fallback if migrations fail
   */
  async createFallbackSchema(): Promise<boolean> {
    try {
      logger.info('Creating fallback database schema...');
      
      // Read the fallback schema SQL
      const fs = await import('fs');
      const path = await import('path');
      
      const schemaPath = path.join(process.cwd(), 'src', 'db', 'fallback-schema.sql');
      
      if (!fs.existsSync(schemaPath)) {
        logger.error('Fallback schema file not found', { path: schemaPath });
        return false;
      }
      
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute the schema creation
      await this.query(schemaSQL);
      
      logger.info('Fallback schema created successfully');
      
      // Fix existing tables if they have missing columns
      await this.fixExistingTables();
      
      // Verify tables were created
      const tables = await this.checkTables();
      const tablesCreated = tables.users && tables.movies && tables.user_movies;
      
      if (tablesCreated) {
        logger.info('Fallback schema verification successful');
        return true;
      } else {
        logger.error('Fallback schema verification failed', { tables });
        return false;
      }
      
    } catch (error) {
      logger.error('Failed to create fallback schema', { error });
      return false;
    }
  }

  /**
   * Fix existing tables by adding missing columns
   */
  async fixExistingTables(): Promise<void> {
    try {
      logger.info('Checking and fixing existing table structures...');

      // First, check if user_movies table exists at all
      const tableExists = await this.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_movies'
        )
      `);

      if (!tableExists.rows[0]?.exists) {
        logger.warn('user_movies table does not exist, skipping structure fixes');
        return;
      }

      logger.info('user_movies table exists, checking column structure');

      // Check user_movies table columns
      const userMoviesColumns = await this.query(`
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_name = 'user_movies' 
        AND table_schema = 'public'
      `);

      const columnNames = userMoviesColumns.rows.map(row => row.column_name);
      
      logger.info('Current user_movies columns', { columnNames });
      
      // Add missing columns to user_movies if needed
      if (!columnNames.includes('effective_normalized_title')) {
        logger.info('Adding effective_normalized_title column to user_movies');
        await this.query(`
          ALTER TABLE user_movies 
          ADD COLUMN IF NOT EXISTS effective_normalized_title text
        `);
        
        logger.info('Populating effective_normalized_title with data from movies');
        // Populate the column with data from related movies
        const updateResult = await this.query(`
          UPDATE user_movies 
          SET effective_normalized_title = COALESCE(
            LOWER(TRIM(REGEXP_REPLACE(
              COALESCE(overridden_title, (SELECT title FROM movies WHERE movies.id = user_movies.movie_id)),
              '[^\\w\\s]', '', 'g'
            ))),
            'unknown'
          )
          WHERE effective_normalized_title IS NULL
        `);
        
        logger.info('Updated effective_normalized_title for rows', { 
          updatedRows: updateResult.rowCount 
        });
        
        // Make it NOT NULL after populating
        await this.query(`
          ALTER TABLE user_movies 
          ALTER COLUMN effective_normalized_title SET NOT NULL
        `);
        
        logger.info('Set effective_normalized_title as NOT NULL');
      } else {
        logger.info('effective_normalized_title column already exists');
      }

      if (!columnNames.includes('is_deleted')) {
        logger.info('Adding is_deleted column to user_movies');
        await this.query(`
          ALTER TABLE user_movies 
          ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false
        `);
      } else {
        logger.info('is_deleted column already exists');
      }

      // Add missing indexes
      logger.info('Creating missing indexes');
      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_user_movies_effective_title 
        ON user_movies(user_id, effective_normalized_title) 
        WHERE NOT is_deleted
      `);

      logger.info('Table structure fixes completed successfully');
      
    } catch (error) {
      logger.error('Failed to fix existing tables', { 
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - this is best effort
    }
  }
}

export const db = new Database();
export default db;
