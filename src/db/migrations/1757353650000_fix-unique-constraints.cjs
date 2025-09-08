/* eslint-disable camelcase */

/**
 * Fix uniqueness constraints according to architectural review:
 * 1. Remove global uniqueness on normalized_title from movies
 * 2. Add effective_normalized_title to user_movies with per-user uniqueness
 * 3. Add performance indexes
 * 4. Add trigger to maintain effective_normalized_title
 * 
 * @typedef {import('node-pg-migrate').ColumnDefinitions} ColumnDefinitions
 * @typedef {import('node-pg-migrate').MigrationBuilder} MigrationBuilder
 */

exports.shorthands = undefined;

/**
 * @param {MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // 1. Remove the problematic unique index on normalized_title
  pgm.dropIndex('movies', 'lower(normalized_title)', { name: 'ux_movies_normalized_title' });

  // 2. Add effective_normalized_title column to user_movies
  pgm.addColumn('user_movies', {
    effective_normalized_title: {
      type: 'text',
      notNull: false
    }
  });

  // 3. Create function to normalize title (same as in backend)
  pgm.sql(`
    CREATE OR REPLACE FUNCTION normalize_title(raw_title text) RETURNS text AS $$
    DECLARE
      normalized text;
    BEGIN
      -- Replace separators (dashes, colons) with spaces, then remove other non-English characters
      normalized := regexp_replace(raw_title, '[-:]', ' ', 'g');
      normalized := regexp_replace(normalized, '[^A-Za-z ]', '', 'g');
      
      -- Trim and collapse multiple spaces into single space
      normalized := trim(normalized);
      normalized := regexp_replace(normalized, '\\s+', ' ', 'g');
      
      -- Capitalize first letter of each word, lowercase the rest
      normalized := initcap(lower(normalized));
      
      RETURN normalized;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
  `);

  // 4. Create trigger function to maintain effective_normalized_title
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_effective_normalized_title() RETURNS trigger AS $$
    DECLARE
      base_title text;
    BEGIN
      -- Get the base title from movies table
      SELECT title INTO base_title FROM movies WHERE id = NEW.movie_id;
      
      -- Calculate effective title: overridden_title if exists, otherwise base title
      NEW.effective_normalized_title := normalize_title(
        COALESCE(NEW.overridden_title, base_title)
      );
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 5. Create trigger on user_movies
  pgm.sql(`
    CREATE TRIGGER trg_user_movies_effective_title
      BEFORE INSERT OR UPDATE ON user_movies
      FOR EACH ROW
      EXECUTE FUNCTION update_effective_normalized_title();
  `);

  // 6. Populate existing records with effective_normalized_title
  pgm.sql(`
    UPDATE user_movies 
    SET effective_normalized_title = normalize_title(
      COALESCE(
        overridden_title, 
        (SELECT title FROM movies WHERE id = user_movies.movie_id)
      )
    );
  `);

  // 7. Make effective_normalized_title NOT NULL after population
  pgm.alterColumn('user_movies', 'effective_normalized_title', {
    notNull: true
  });

  // 8. Create unique index for per-user title uniqueness
  pgm.createIndex('user_movies', ['user_id', 'lower(effective_normalized_title)'], {
    unique: true,
    name: 'ux_user_movies_effective_title'
  });

  // 9. Add performance indexes

  // Index for user's custom movies
  pgm.createIndex('movies', ['source', 'created_by_user_id'], {
    name: 'idx_movies_source_creator'
  });

  // Trigram index on normalized_title for fuzzy search
  pgm.sql('CREATE INDEX idx_movies_normalized_title_trgm ON movies USING gin (normalized_title gin_trgm_ops);');

  // GIN indexes for array fields (genre, director)
  pgm.sql('CREATE INDEX idx_movies_genre_gin ON movies USING gin (genre);');
  pgm.sql('CREATE INDEX idx_movies_director_gin ON movies USING gin (director);');

  // User movies performance indexes
  pgm.createIndex('user_movies', ['user_id', 'is_favorite'], {
    name: 'idx_user_movies_favorites'
  });

  pgm.createIndex('user_movies', ['user_id', 'updated_at'], {
    name: 'idx_user_movies_updated'
  });
};

/**
 * @param {MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  // Drop indexes
  pgm.dropIndex('user_movies', ['user_id', 'updated_at'], { name: 'idx_user_movies_updated' });
  pgm.dropIndex('user_movies', ['user_id', 'is_favorite'], { name: 'idx_user_movies_favorites' });
  pgm.sql('DROP INDEX IF EXISTS idx_movies_director_gin;');
  pgm.sql('DROP INDEX IF EXISTS idx_movies_genre_gin;');
  pgm.sql('DROP INDEX IF EXISTS idx_movies_normalized_title_trgm;');
  pgm.dropIndex('movies', ['source', 'created_by_user_id'], { name: 'idx_movies_source_creator' });

  // Drop unique constraint
  pgm.dropIndex('user_movies', ['user_id', 'lower(effective_normalized_title)'], { 
    name: 'ux_user_movies_effective_title' 
  });

  // Drop trigger and functions
  pgm.sql('DROP TRIGGER IF EXISTS trg_user_movies_effective_title ON user_movies;');
  pgm.sql('DROP FUNCTION IF EXISTS update_effective_normalized_title();');
  pgm.sql('DROP FUNCTION IF EXISTS normalize_title(text);');

  // Drop column
  pgm.dropColumn('user_movies', 'effective_normalized_title');

  // Restore the problematic unique index (for rollback consistency)
  pgm.createIndex('movies', 'lower(normalized_title)', { 
    unique: true, 
    name: 'ux_movies_normalized_title' 
  });
};
