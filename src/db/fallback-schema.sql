-- Fallback schema creation if migrations fail
-- This should match the latest migration state

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    username text NOT NULL UNIQUE,
    email text,
    password_hash text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_username_length CHECK (char_length(username) BETWEEN 3 AND 50)
);

-- Create unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));

-- Movies table  
CREATE TABLE IF NOT EXISTS movies (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    omdb_id text UNIQUE,
    title text NOT NULL,
    normalized_title text NOT NULL,
    year integer,
    runtime_minutes integer,
    genre text[],
    director text[],
    poster text,
    source text NOT NULL,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_source CHECK (source IN ('omdb', 'custom'))
);

-- Movies indexes
CREATE UNIQUE INDEX IF NOT EXISTS ux_movies_normalized_title ON movies (lower(normalized_title)) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_movies_title_trgm ON movies USING gin (title gin_trgm_ops);

-- User movies junction table
CREATE TABLE IF NOT EXISTS user_movies (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id uuid NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    is_favorite boolean NOT NULL DEFAULT false,
    overridden_title text,
    overridden_year integer,
    overridden_runtime_minutes integer,
    overridden_genre text[],
    overridden_director text[],
    effective_normalized_title text NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, movie_id)
);

-- Create indexes for user_movies
CREATE INDEX IF NOT EXISTS idx_user_movies_user_id ON user_movies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_movies_movie_id ON user_movies(movie_id);
CREATE INDEX IF NOT EXISTS idx_user_movies_effective_title ON user_movies(user_id, effective_normalized_title) WHERE NOT is_deleted;

-- Grant permissions if needed
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_user WHERE usename = 'movies_user') THEN
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO movies_user;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO movies_user;
    END IF;
END $$;
