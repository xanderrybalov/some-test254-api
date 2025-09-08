/* eslint-disable camelcase */

/**
 * @typedef {import('node-pg-migrate').ColumnDefinitions} ColumnDefinitions
 * @typedef {import('node-pg-migrate').MigrationBuilder} MigrationBuilder
 */

exports.shorthands = undefined;

/**
 * @param {MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Create extensions
  pgm.createExtension('uuid-ossp', { ifNotExists: true });
  pgm.createExtension('pg_trgm', { ifNotExists: true });

  // Users table
  pgm.createTable('users', {
    id: { 
      type: 'uuid', 
      primaryKey: true, 
      default: pgm.func('uuid_generate_v4()') 
    },
    username: { 
      type: 'text', 
      notNull: true, 
      unique: true 
    },
    created_at: { 
      type: 'timestamptz', 
      notNull: true, 
      default: pgm.func('now()') 
    },
  });

  // Add constraint for username length
  pgm.addConstraint('users', 'chk_username_length', {
    check: 'char_length(username) BETWEEN 3 AND 50'
  });

  // Movies table
  pgm.createTable('movies', {
    id: { 
      type: 'uuid', 
      primaryKey: true, 
      default: pgm.func('uuid_generate_v4()') 
    },
    omdb_id: { 
      type: 'text',
      unique: true 
    },
    title: { 
      type: 'text', 
      notNull: true 
    },
    normalized_title: { 
      type: 'text', 
      notNull: true 
    },
    year: 'integer',
    runtime_minutes: 'integer',
    genre: 'text[]',
    director: 'text[]',
    source: { 
      type: 'text', 
      notNull: true 
    },
    created_by_user_id: { 
      type: 'uuid', 
      references: '"users"(id)', 
      onDelete: 'SET NULL' 
    },
    created_at: { 
      type: 'timestamptz', 
      notNull: true, 
      default: pgm.func('now()') 
    },
    updated_at: { 
      type: 'timestamptz', 
      notNull: true, 
      default: pgm.func('now()') 
    },
  });

  // Add constraint for source
  pgm.addConstraint('movies', 'chk_source', {
    check: "source IN ('omdb', 'custom')"
  });

  // Create unique index on normalized_title (case-insensitive)
  pgm.createIndex('movies', 'lower(normalized_title)', { 
    unique: true, 
    name: 'ux_movies_normalized_title' 
  });

  // Create trigram index for title search
  pgm.sql('CREATE INDEX idx_movies_title_trgm ON movies USING gin (title gin_trgm_ops);');

  // User movies junction table
  pgm.createTable('user_movies', {
    user_id: { 
      type: 'uuid', 
      notNull: true, 
      references: '"users"(id)', 
      onDelete: 'CASCADE' 
    },
    movie_id: { 
      type: 'uuid', 
      notNull: true, 
      references: '"movies"(id)', 
      onDelete: 'CASCADE' 
    },
    is_favorite: { 
      type: 'boolean', 
      notNull: true, 
      default: false 
    },
    overridden_title: 'text',
    overridden_year: 'integer',
    overridden_runtime_minutes: 'integer',
    overridden_genre: 'text[]',
    overridden_director: 'text[]',
    created_at: { 
      type: 'timestamptz', 
      notNull: true, 
      default: pgm.func('now()') 
    },
    updated_at: { 
      type: 'timestamptz', 
      notNull: true, 
      default: pgm.func('now()') 
    },
  });

  // Add composite primary key for user_movies
  pgm.addConstraint('user_movies', 'pk_user_movies', { 
    primaryKey: ['user_id', 'movie_id'] 
  });
};

/**
 * @param {MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('user_movies');
  pgm.dropTable('movies');
  pgm.dropTable('users');
  pgm.dropExtension('pg_trgm');
  pgm.dropExtension('uuid-ossp');
};
