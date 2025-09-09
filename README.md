# Some-test254-api

HTTP API for managing movies with integration to the OMDB API. Built with **Node.js 22**, **Express 5**, and **PostgreSQL**.

## Features

* Movie search via OMDB API with caching
* Personalized movie collection management
* Favorites system
* Custom overrides for movie data
* Built-in security and rate limiting
* Full logging support
* Unit and end-to-end tests
* Docker support for deployment

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Fill in the required environment variables:

```env
NODE_ENV=development
PORT=8080
DATABASE_URL=postgres://movies_user:movies_pass@localhost:5432/movies_api
OMDB_API_KEY=your_omdb_key_here
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
CORS_ORIGIN=http://localhost:3000
CACHE_TTL_HOURS=24
```

### 3. Start PostgreSQL

```bash
docker-compose up -d postgres
```

### 4. Run migrations

```bash
npm run migrate:up
```

### 5. Start the server

For development:

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

## Environment Variables

Copy `env.example` to `.env` and configure:

```bash
# Authentication (required)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_EXPIRES_IN=7d
PASSWORD_PEPPER=optional-additional-security-layer

# Database
DATABASE_URL=postgres://movies_user:movies_pass@localhost:5432/movies_api

# OMDB API  
OMDB_API_KEY=your-omdb-api-key

# Other settings (optional)
NODE_ENV=development
PORT=8080
CORS_ORIGIN=http://localhost:3000
```

**Security Notes:**
- ✅ **Passwords are hashed with Argon2id** (industry standard)
- ✅ **JWT tokens** with configurable expiration
- ✅ **Optional password pepper** for additional security
- ✅ **Minimum 32-character JWT secret** required

## API Endpoints

### Authentication (Public)

* `POST /api/auth/register` — Register new user
* `POST /api/auth/login` — Login user  
* `POST /api/auth/verify` — Verify JWT token (token via header or body)

### Movie search (Public - with optional authentication)

* `POST /api/movies/search` — **Hybrid search**: OMDB + custom movies (body: query, page)
  - **Without token**: searches only OMDB API
  - **With token**: searches OMDB API + your custom movies (custom movies shown first)
* `GET /api/movies/:movieId` — Get movie details
* `POST /api/movies/by-ids` — Fetch multiple movies by IDs

### User movie management (Protected - requires Bearer token)

* `GET /api/users/:userId/movies` — Get user's movie collection
* `POST /api/users/:userId/movies` — Create a custom movie
* `PUT /api/users/:userId/movies/:movieId` — Edit a movie (poster is immutable)
* `PUT /api/users/:userId/movies/:movieId/favorite` — Mark as favorite
* `DELETE /api/users/:userId/movies/:movieId` — Delete a movie

## Development

### Testing

```bash
# Unit tests
npm test

# End-to-end tests
npm run test:e2e

# Code coverage
npm run test:coverage
```

`## Testing with Postman

### Setup

1. Create a Postman variable:

   ```
   baseUrl = http://localhost:8080/api
   ```
2. Make sure the server is running:

   ```bash
   npm run dev
   ```

### Example requests (in order)

1. **Register new user**
   **POST** `{{baseUrl}}/auth/register`

   ```json
   {
     "username": "testuser2024",
     "email": "test@example.com",
     "password": "MySecurePassword123"
   }
   ```

   Response includes JWT token:
   ```json
   {
     "user": {"id": "...", "username": "...", "email": "..."},
     "token": "eyJhbGciOiJIUzI1NiIs...",
     "expiresIn": "7d"
   }
   ```

2. **Login user**
   **POST** `{{baseUrl}}/auth/login`

   ```json
   {
     "login": "testuser2024",
     "password": "MySecurePassword123"
   }
   ```

3. **Verify token (optional)**
   **POST** `{{baseUrl}}/auth/verify`

   **Option A - Via Authorization header:**
   Headers: `Authorization: Bearer {token}`
   Body: empty or `{}`

   **Option B - Via request body:**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIs..."
   }
   ```

4. **Search movies (hybrid)**
   **POST** `{{baseUrl}}/movies/search`

   **Without token** (OMDB only):
   ```json
   {
     "query": "matrix",
     "page": 1
   }
   ```

   **With token** (OMDB + custom movies):
   Headers: `Authorization: Bearer {token}`
   ```json
   {
     "query": "matrix",
     "page": 1
   }
   ```

   Response includes `includesCustomMovies: true/false` field.

5. **Fetch movies by IDs**
   **POST** `{{baseUrl}}/movies/by-ids`

   ```json
   {
     "ids": ["uuid-from-search-results-above"]
   }
   ```

**⚠️ All following endpoints require Authorization header:**
`Authorization: Bearer {token from login/register response}`

6. **Get user's movies**
   **GET** `{{baseUrl}}/users/{userId}/movies`
   Headers: `Authorization: Bearer {token}`

7. **Create custom movie**
   **POST** `{{baseUrl}}/users/{userId}/movies`
   Headers: `Authorization: Bearer {token}`

   ```json
   {
     "title": "My Custom Movie",
     "year": 2023,
     "runtimeMinutes": 120,
     "genre": ["Action", "Drama"],
     "director": ["Custom Director"],
     "poster": "https://example.com/poster.jpg"
   }
   ```

8. **Update movie**
   **PUT** `{{baseUrl}}/users/{userId}/movies/{movieId}`
   Headers: `Authorization: Bearer {token}`

   ```json
   {
     "title": "Updated Movie Title",
     "year": 2024,
     "runtimeMinutes": 135,
     "genre": ["Action", "Sci-Fi", "Thriller"],
     "director": ["Updated Director", "Co-Director"]
   }
   ```

   **Note:** `poster` field cannot be updated - it's set only during creation.

9. **Mark as favorite**
   **PUT** `{{baseUrl}}/users/{userId}/movies/{movieId}/favorite`
   Headers: `Authorization: Bearer {token}`

   ```json
   {
     "isFavorite": true
   }
   ```

10. **Get only favorites**
   **GET** `{{baseUrl}}/users/{userId}/movies?favorites=true`
   Headers: `Authorization: Bearer {token}`

11. **Get movie details** (public)
   **GET** `{{baseUrl}}/movies/{movieId}`

12. **Delete movie**
   **DELETE** `{{baseUrl}}/users/{userId}/movies/{movieId}`
   Headers: `Authorization: Bearer {token}`

### Testing order

1. Create a user (#1)
2. Search for movies (#2)
3. Create a custom movie (#5)
4. Use the returned IDs to test the rest of the endpoints

> All requests use JSON body. Don’t forget to set the header `Content-Type: application/json`.


### Linting and formatting

```bash
npm run lint
npm run format
```

### Database migrations

```bash
# Create a new migration
npm run migrate:create migration_name

# Apply all migrations
npm run migrate:up

# Roll back the last migration
npm run migrate:down
```

## Project structure

```
src/
├── app.ts              # Express application setup
├── server.ts           # HTTP server entry point
├── config/             # Configurations
├── db/                 # Database and migrations
├── domain/             # Business logic
├── omdb/               # OMDB API integration
├── movies/             # Movie management
├── users/              # User management
├── userMovies/         # User–movie relations
├── middlewares/        # Express middlewares
└── routes.ts           # API routes
```

## Technologies

* **Runtime:** Node.js 22
* **Framework:** Express 5
* **Database:** PostgreSQL + pg
* **Migrations:** node-pg-migrate
* **Validation:** Zod
* **Security:** helmet, cors, express-rate-limit
* **Logging:** Pino
* **Testing:** Vitest + Supertest
* **Development:** TypeScript, tsx

## Deployment

### Docker

```bash
# Build image
docker build -t movies-api .

# Run container
docker run -p 8080:8080 --env-file .env movies-api
```

### Manual deployment

```bash
npm run build
NODE_ENV=production npm start
```

## License

MIT
