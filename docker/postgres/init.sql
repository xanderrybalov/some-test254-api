-- Initialize PostgreSQL for movies API

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant permissions to user  
GRANT ALL PRIVILEGES ON DATABASE movies TO movies_user;
GRANT ALL ON SCHEMA public TO movies_user;

-- The actual tables will be created by migrations
