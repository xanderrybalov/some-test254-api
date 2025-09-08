import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Movies API', () => {
  let testUserId: string;
  let testMovieId: string;

  beforeAll(async () => {
    // Create a test user
    const userResponse = await request(app)
      .post('/api/users/ensure')
      .send({ username: 'movietestuser' });
    
    testUserId = userResponse.body.user.id;
  });

  describe('POST /api/movies/search', () => {
    it('should search movies via OMDB', async () => {
      const response = await request(app)
        .post('/api/movies/search')
        .send({ query: 'matrix', page: 1 })
        .expect(200);

      expect(response.body).toMatchObject({
        items: expect.any(Array),
        page: 1,
        total: expect.any(Number),
      });
    });

    it('should require query parameter', async () => {
      await request(app)
        .post('/api/movies/search')
        .send({})
        .expect(400);
    });

    it('should validate page parameter', async () => {
      await request(app)
        .post('/api/movies/search')
        .send({ query: 'test', page: 0 })
        .expect(400);
    });
  });

  describe('POST /api/users/:userId/movies', () => {
    it('should create a custom movie', async () => {
      const movieData = {
        title: 'Test Custom Movie',
        year: 2023,
        runtimeMinutes: 120,
        genre: ['Action', 'Drama'],
        director: ['Test Director'],
      };

      const response = await request(app)
        .post(`/api/users/${testUserId}/movies`)
        .send(movieData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: movieData.title,
        year: movieData.year,
        runtimeMinutes: movieData.runtimeMinutes,
        genre: movieData.genre,
        director: movieData.director,
        source: 'custom',
      });

      testMovieId = response.body.id;
    });

    it('should prevent duplicate movie titles', async () => {
      const movieData = {
        title: 'Test Custom Movie', // Same as above
        year: 2023,
        runtimeMinutes: 120,
        genre: ['Action'],
        director: ['Test Director'],
      };

      await request(app)
        .post(`/api/users/${testUserId}/movies`)
        .send(movieData)
        .expect(409);
    });

    it('should validate movie data', async () => {
      // Missing title
      await request(app)
        .post(`/api/users/${testUserId}/movies`)
        .send({
          year: 2023,
          runtimeMinutes: 120,
          genre: ['Action'],
          director: ['Test Director'],
        })
        .expect(400);

      // Invalid year
      await request(app)
        .post(`/api/users/${testUserId}/movies`)
        .send({
          title: 'Test Movie',
          year: 1800, // Too old
          runtimeMinutes: 120,
          genre: ['Action'],
          director: ['Test Director'],
        })
        .expect(400);
    });
  });

  describe('GET /api/users/:userId/movies', () => {
    it('should get user movies', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}/movies`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));
      if (response.body.length > 0) {
        expect(response.body[0]).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          isFavorite: expect.any(Boolean),
          source: expect.any(String),
        });
      }
    });

    it('should filter favorites only', async () => {
      await request(app)
        .get(`/api/users/${testUserId}/movies`)
        .query({ favorites: 'true' })
        .expect(200);
    });
  });

  describe('PUT /api/users/:userId/movies/:movieId/favorite', () => {
    it('should set movie as favorite', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/movies/${testMovieId}/favorite`)
        .send({ isFavorite: true })
        .expect(200);

      expect(response.body).toMatchObject({ ok: true });
    });

    it('should validate isFavorite parameter', async () => {
      await request(app)
        .put(`/api/users/${testUserId}/movies/${testMovieId}/favorite`)
        .send({ isFavorite: 'yes' }) // Should be boolean
        .expect(400);
    });
  });

  describe('DELETE /api/users/:userId/movies/:movieId', () => {
    it('should delete custom movie', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUserId}/movies/${testMovieId}`)
        .expect(200);

      expect(response.body).toMatchObject({ ok: true });
    });

    it('should return 404 for non-existent movie', async () => {
      await request(app)
        .delete(`/api/users/${testUserId}/movies/00000000-0000-0000-0000-000000000000`)
        .expect(404);
    });
  });
});
