import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(65535))
    .default('8080'),
  DATABASE_URL: z.string().url(),
  OMDB_API_KEY: z.string().min(1),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('60000'),
  RATE_LIMIT_MAX: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('120'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CACHE_TTL_HOURS: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('24'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PASSWORD_PEPPER: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach(err => {
      console.error(`${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export { env };
