// Error handling utilities and custom error classes
// Requirements: 8.7
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';

/**
 * Custom error classes
 */
export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string = 'Too many requests',
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends Error {
  constructor(
    service: string,
    message: string,
    public statusCode?: number
  ) {
    super(`${service} error: ${message}`);
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Error response builder
 */
export function buildErrorResponse(
  error: Error | unknown,
  context?: { operation?: string; userId?: string }
): NextResponse {
  // Log the error
  const log = logger.child(context || {});

  // Handle known error types
  if (error instanceof ValidationError) {
    log.warn('Validation error', { error: error.message, details: error.details });
    return NextResponse.json(
      {
        error: error.message,
        details: error.details,
      },
      { status: 400 }
    );
  }

  if (error instanceof ZodError) {
    log.warn('Zod validation error', { errors: error.errors });
    return NextResponse.json(
      {
        error: 'Invalid request parameters',
        details: error.errors,
      },
      { status: 400 }
    );
  }

  if (error instanceof AuthenticationError) {
    log.warn('Authentication error', { error: error.message });
    return NextResponse.json(
      { error: error.message },
      { status: 401 }
    );
  }

  if (error instanceof AuthorizationError) {
    log.warn('Authorization error', { error: error.message });
    return NextResponse.json(
      { error: error.message },
      { status: 403 }
    );
  }

  if (error instanceof NotFoundError) {
    log.info('Resource not found', { error: error.message });
    return NextResponse.json(
      { error: error.message },
      { status: 404 }
    );
  }

  if (error instanceof RateLimitError) {
    log.warn('Rate limit exceeded', { error: error.message });
    const headers: Record<string, string> = {};
    if (error.retryAfter) {
      headers['Retry-After'] = error.retryAfter.toString();
    }
    return NextResponse.json(
      { error: error.message },
      { status: 429, headers }
    );
  }

  if (error instanceof ExternalServiceError) {
    log.error('External service error', error, { statusCode: error.statusCode });
    return NextResponse.json(
      { error: 'External service unavailable. Please try again later.' },
      { status: 502 }
    );
  }

  if (error instanceof DatabaseError) {
    log.error('Database error', error.originalError || error);
    return NextResponse.json(
      { error: 'Database error. Please try again later.' },
      { status: 500 }
    );
  }

  // Handle generic errors
  if (error instanceof Error) {
    log.error('Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  // Unknown error type
  log.error('Unknown error type', undefined, { error });
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Async error handler wrapper for API routes
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  context?: { operation?: string }
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return buildErrorResponse(error, context);
    }
  };
}
