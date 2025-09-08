import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Users API', () => {
  describe('POST /api/users/ensure', () => {
    it('should create a new user', async () => {
      const userData = {
        username: 'testuser123'
      };

      const response = await request(app)
        .post('/api/users/ensure')
        .send(userData)
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          id: expect.any(String),
          username: userData.username,
        },
      });
    });

    it('should return existing user if username already exists', async () => {
      const userData = {
        username: 'existinguser'
      };

      // Create user first time
      const firstResponse = await request(app)
        .post('/api/users/ensure')
        .send(userData)
        .expect(200);

      // Try to create same user again
      const secondResponse = await request(app)
        .post('/api/users/ensure')
        .send(userData)
        .expect(200);

      expect(firstResponse.body.user.id).toBe(secondResponse.body.user.id);
    });

    it('should validate username length', async () => {
      // Too short
      await request(app)
        .post('/api/users/ensure')
        .send({ username: 'ab' })
        .expect(400);

      // Too long
      await request(app)
        .post('/api/users/ensure')
        .send({ username: 'a'.repeat(51) })
        .expect(400);
    });

    it('should require username field', async () => {
      await request(app)
        .post('/api/users/ensure')
        .send({})
        .expect(400);
    });
  });
});
