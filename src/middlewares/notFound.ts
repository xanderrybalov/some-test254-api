import { Request, Response, NextFunction } from 'express';

/**
 * 404 Not Found handler middleware
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
}
