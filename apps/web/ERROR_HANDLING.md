# Error Handling and Logging

This document describes the error handling and logging infrastructure for the FuelFuse backend API.

## Overview

The backend implements comprehensive error handling with:
- Structured error logging with Sentry integration
- Custom error classes for different error types
- Timeout and retry logic for external API calls
- Consistent error responses across all endpoints

## Error Classes

Located in `lib/errors.ts`:

### ValidationError
Used for input validation failures (400 Bad Request)
```typescript
throw new ValidationError('Invalid search parameters', zodError.errors);
```

### AuthenticationError
Used for missing or invalid authentication (401 Unauthorized)
```typescript
throw new AuthenticationError('Invalid token');
```

### AuthorizationError
Used for insufficient permissions (403 Forbidden)
```typescript
throw new AuthorizationError('Pro subscription required');
```

### NotFoundError
Used for missing resources (404 Not Found)
```typescript
throw new NotFoundError('Station');
```

### RateLimitError
Used for rate limiting (429 Too Many Requests)
```typescript
throw new RateLimitError('Too many requests', retryAfter);
```

### ExternalServiceError
Used for external API failures (502 Bad Gateway)
```typescript
throw new ExternalServiceError('FuelFinderAPI', 'Request timeout', 408);
```

### DatabaseError
Used for database operation failures (500 Internal Server Error)
```typescript
throw new DatabaseError('Failed to upsert station', originalError);
```

## Error Response Builder

The `buildErrorResponse()` function automatically:
- Maps error types to appropriate HTTP status codes
- Logs errors to Sentry with context
- Redacts PII from logs
- Returns consistent JSON error responses

Usage in API routes:
```typescript
import { buildErrorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    // Your logic here
  } catch (error) {
    return buildErrorResponse(error, { operation: 'search', userId: 'user123' });
  }
}
```

## Structured Logging

Located in `lib/logger.ts`:

### Logger Methods
- `logger.debug(message, data?)` - Debug information (development only, not sent to Sentry)
- `logger.info(message, data?)` - Informational messages (sent as breadcrumbs to Sentry)
- `logger.warn(message, data?)` - Warning messages (sent to Sentry as warnings)
- `logger.error(message, error?, data?)` - Error messages (sent to Sentry with stack traces)

### Creating Child Loggers
```typescript
const log = logger.child({ operation: 'search', userId: 'user123' });
log.info('Search completed', { resultCount: 10 });
log.error('Search failed', error, { query: 'SW1A 1AA' });
```

### User Context
```typescript
// Set user context for Sentry tracking
logger.setUser(userId, email); // email only included in development

// Clear user context (e.g., on logout)
logger.clearUser();
```

### Tags and Context
```typescript
// Add tags for filtering in Sentry
logger.setTags({ environment: 'production', version: '1.0.0' });

// Set custom context
logger.setContext('payment', { amount: 1000, currency: 'GBP' });
```

### PII Redaction
The logger automatically redacts sensitive fields from logs:
- email
- postcode
- address
- phone
- name
- password
- token

PII redaction applies to all log data and nested objects.

## External API Utilities

Located in `lib/external-api.ts`:

### fetchWithTimeout
Fetch with automatic timeout and retry logic:
```typescript
import { fetchWithTimeout, TIMEOUTS } from '@/lib/external-api';

const response = await fetchWithTimeout(
  url,
  { method: 'GET', headers: { ... } },
  {
    timeout: TIMEOUTS.FUEL_FINDER_API,
    retries: 3,
    retryDelay: 1000,
    service: 'FuelFinderAPI',
  }
);
```

### fetchJSON
Convenience wrapper for JSON responses:
```typescript
import { fetchJSON, TIMEOUTS } from '@/lib/external-api';

const data = await fetchJSON<MyType>(
  url,
  { method: 'GET', headers: { ... } },
  { timeout: TIMEOUTS.POSTCODES_IO, service: 'PostcodesIO' }
);
```

### Timeout Configuration
Predefined timeouts for different services:
- `TIMEOUTS.FUEL_FINDER_API` - 15 seconds
- `TIMEOUTS.POSTCODES_IO` - 10 seconds
- `TIMEOUTS.EXPO_PUSH` - 10 seconds
- `TIMEOUTS.STRIPE` - 15 seconds
- `TIMEOUTS.DATABASE` - 5 seconds

### Retry Logic
- Automatic retry for 429 (rate limit) and 5xx (server errors)
- Exponential backoff: 1s, 2s, 4s
- Configurable retry count (default: 3)

## Sentry Integration

### Configuration
Sentry is configured in three files with comprehensive PII redaction:
- `sentry.server.config.ts` - Server-side tracking with request/header redaction
- `sentry.client.config.ts` - Client-side tracking with session replay
- `sentry.edge.config.ts` - Edge runtime tracking with request/header redaction

All configurations include:
- Automatic PII redaction from user context, requests, and breadcrumbs
- Environment-based sampling rates (10% in production, 100% in development)
- Session replay with text and media masking (client-side only)

### Environment Variables
```bash
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Automatic Error Tracking
All errors logged via `logger.error()` or `logger.warn()` are automatically sent to Sentry with:
- Stack traces
- Context (operation, service, userId, etc.)
- Tags for filtering
- Comprehensive PII redaction

### PII Redaction in Sentry
The Sentry `beforeSend` hook automatically redacts:
- User email and username (in production)
- Query parameters
- Cookies
- Authorization headers
- Breadcrumb data containing PII fields

## Best Practices

### 1. Use Custom Error Classes
```typescript
// Good
throw new ValidationError('Invalid postcode', details);

// Avoid
throw new Error('Invalid postcode');
```

### 2. Add Context to Logs
```typescript
// Good
const log = logger.child({ operation: 'search', userId });
log.info('Search completed', { resultCount: results.length });

// Avoid
console.log('Search completed');
```

### 3. Use Error Response Builder
```typescript
// Good
return buildErrorResponse(error, { operation: 'search' });

// Avoid
return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
```

### 4. Use External API Utilities
```typescript
// Good
const data = await fetchJSON(url, init, { 
  timeout: TIMEOUTS.FUEL_FINDER_API,
  service: 'FuelFinderAPI'
});

// Avoid
const response = await fetch(url, init);
const data = await response.json();
```

### 5. Wrap Database Operations
```typescript
try {
  await prisma.station.create({ ... });
} catch (error) {
  throw new DatabaseError('Failed to create station', error);
}
```

### 6. Set User Context
```typescript
// After authentication
logger.setUser(userId);

// Before operations
const log = logger.child({ operation: 'createAlert', userId });
log.info('Creating alert rule', { fuelType, radius });
```

### 7. Use Structured Error Logging
```typescript
// Good - provides context and stack trace
log.error('Failed to send notification', error, { 
  userId, 
  alertId, 
  stationId 
});

// Avoid - loses context
console.error('Error:', error);
```

## Testing Error Handling

### Unit Tests
Test error handling in services:
```typescript
test('throws ValidationError for invalid input', async () => {
  await expect(searchByPostcode({ postcode: 'INVALID' }))
    .rejects.toThrow(ValidationError);
});
```

### Integration Tests
Test error responses in API routes:
```typescript
test('returns 400 for invalid parameters', async () => {
  const response = await GET(request);
  expect(response.status).toBe(400);
  const body = await response.json();
  expect(body.error).toBeDefined();
});
```

## Monitoring

### Sentry Dashboard
Monitor errors in production:
1. Error frequency and trends
2. Stack traces and context
3. User impact
4. Performance metrics

### Log Analysis
Structured logs can be analyzed for:
- Operation performance
- Error patterns
- User behavior
- System health

## Requirements Validation

This implementation satisfies:
- **Requirement 8.7**: Structured error logging with timeouts for external APIs
- **Requirement 13.7**: Sentry integration for error tracking
