/* eslint-disable camelcase */

/**
 * Add authentication fields to users table
 * - password_hash: Argon2id hash of the password
 * - email: User email for login (optional)
 * - created_at/updated_at: Already exist
 * - Make username unique if not already
 * 
 * @typedef {import('node-pg-migrate').ColumnDefinitions} ColumnDefinitions
 * @typedef {import('node-pg-migrate').MigrationBuilder} MigrationBuilder
 */

exports.shorthands = undefined;

/**
 * @param {MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Add password_hash column
  pgm.addColumn('users', {
    password_hash: {
      type: 'text',
      notNull: false // Allow NULL during migration, we'll make it required for new users
    }
  });

  // Add email column (optional, can be used instead of username for login)
  pgm.addColumn('users', {
    email: {
      type: 'text',
      notNull: false
    }
  });

  // Add unique constraint on email if provided
  pgm.sql('CREATE UNIQUE INDEX ux_users_email ON users (lower(email)) WHERE email IS NOT NULL;');

  // Add index for faster lookups
  pgm.createIndex('users', 'lower(username)', {
    name: 'idx_users_username_lower'
  });
};

/**
 * @param {MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  // Drop indexes
  pgm.dropIndex('users', 'lower(username)', { name: 'idx_users_username_lower' });
  pgm.sql('DROP INDEX IF EXISTS ux_users_email;');

  // Drop columns
  pgm.dropColumn('users', 'email');
  pgm.dropColumn('users', 'password_hash');
};
