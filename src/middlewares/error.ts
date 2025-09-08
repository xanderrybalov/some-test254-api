import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../config/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Zod validation errors
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      details: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    });
    return;
  }

  // Known application errors
  if (error.isOperational && error.statusCode) {
    res.status(error.statusCode).json({
      error: error.message,
    });
    return;
  }

  // Database connection errors
  if (error.message.includes('ECONNREFUSED') || error.message.includes('database')) {
    res.status(503).json({
      error: 'Service temporarily unavailable',
    });
    return;
  }

  // OMDB API errors
  if (error.message.includes('OMDB') || error.message.includes('fetch')) {
    res.status(502).json({
      error: 'External service error',
    });
    return;
  }

  // Default to 500 server error
  res.status(500).json({
    error: 'Internal server error',
  });
}

/**
 * Create operational error
 */
export function createError(message: string, statusCode: number = 500): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}
