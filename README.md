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

## API Endpoints

### Users

* `POST /api/users/ensure` — Create or find a user

### Movie search

* `POST /api/movies/search` — Search via OMDB (body: query, page)
* `GET /api/movies/:movieId` — Get movie details
* `POST /api/movies/by-ids` — Fetch multiple movies by IDs

### User movie management

* `GET /api/users/:userId/movies` — Get user’s movie collection
* `POST /api/users/:userId/movies` — Create a custom movie
* `PUT /api/users/:userId/movies/:movieId` — Edit a movie
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

1. **Create or get user**
   **POST** `{{baseUrl}}/users/ensure`

   ```json
   {
     "username": "testuser"
   }
   ```

2. **Search movies via OMDB**
   **GET** `{{baseUrl}}/movies/search?query=matrix&page=1`

3. **Fetch movies by IDs**
   **POST** `{{baseUrl}}/movies/by-ids`

   ```json
   {
     "ids": ["uuid-from-search-results-above"]
   }
   ```

4. **Get user’s movies**
   **GET** `{{baseUrl}}/users/{userId}/movies`

5. **Create custom movie**
   **POST** `{{baseUrl}}/users/{userId}/movies`

   ```json
   {
     "title": "My Custom Movie",
     "year": 2023,
     "runtimeMinutes": 120,
     "genre": ["Action", "Drama"],
     "director": ["Custom Director"]
   }
   ```

6. **Update movie**
   **PUT** `{{baseUrl}}/users/{userId}/movies/{movieId}`

   ```json
   {
     "title": "Updated Movie Title",
     "year": 2024,
     "runtimeMinutes": 135,
     "genre": ["Action", "Sci-Fi", "Thriller"],
     "director": ["Updated Director", "Co-Director"]
   }
   ```

7. **Mark as favorite**
   **PUT** `{{baseUrl}}/users/{userId}/movies/{movieId}/favorite`

   ```json
   {
     "isFavorite": true
   }
   ```

8. **Get only favorites**
   **GET** `{{baseUrl}}/users/{userId}/movies?favorites=true`

9. **Get movie details**
   **GET** `{{baseUrl}}/movies/{movieId}`

10. **Delete movie**
    **DELETE** `{{baseUrl}}/users/{userId}/movies/{movieId}`
`
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
