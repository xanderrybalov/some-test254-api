/* eslint-disable camelcase */

/**
 * Add soft delete functionality to movies table
 * This allows safer deletion of movies while preserving cache and references
 * 
 * @typedef {import('node-pg-migrate').ColumnDefinitions} ColumnDefinitions
 * @typedef {import('node-pg-migrate').MigrationBuilder} MigrationBuilder
 */

exports.shorthands = undefined;

/**
 * @param {MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Add is_deleted column to movies
  pgm.addColumn('movies', {
    is_deleted: {
      type: 'boolean',
      notNull: true,
      default: false
    }
  });

  // Add deleted_at column for audit trail
  pgm.addColumn('movies', {
    deleted_at: {
      type: 'timestamptz',
      notNull: false
    }
  });

  // Add index for efficient querying of active movies
  pgm.createIndex('movies', 'is_deleted', {
    name: 'idx_movies_is_deleted'
  });

  // Add partial index for active movies (better performance)
  pgm.sql('CREATE INDEX idx_movies_active ON movies (created_at DESC) WHERE is_deleted = false;');

  // Create function to handle soft delete
  pgm.sql(`
    CREATE OR REPLACE FUNCTION soft_delete_movie() RETURNS trigger AS $$
    BEGIN
      -- Set deleted flags and timestamp
      NEW.is_deleted = true;
      NEW.deleted_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

/**
 * @param {MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  // Drop function
  pgm.sql('DROP FUNCTION IF EXISTS soft_delete_movie();');

  // Drop indexes
  pgm.sql('DROP INDEX IF EXISTS idx_movies_active;');
  pgm.dropIndex('movies', 'is_deleted', { name: 'idx_movies_is_deleted' });

  // Drop columns
  pgm.dropColumn('movies', 'deleted_at');
  pgm.dropColumn('movies', 'is_deleted');
};
