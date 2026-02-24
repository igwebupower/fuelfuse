// Sentry edge runtime configuration
// Requirements: 8.7, 13.7
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Redact PII from error events
  beforeSend(event, hint) {
    // Redact sensitive data from user context
    if (event.user) {
      // Keep user ID for tracking, but remove email in production
      if (process.env.NODE_ENV === 'production') {
        delete event.user.email;
        delete event.user.username;
      }
    }

    // Redact sensitive data from request
    if (event.request) {
      // Redact query parameters that might contain PII
      if (event.request.query_string) {
        event.request.query_string = '[REDACTED]';
      }
      
      // Redact cookies
      if (event.request.cookies) {
        event.request.cookies = '[REDACTED]';
      }
      
      // Redact authorization headers
      if (event.request.headers) {
        const headers = event.request.headers as Record<string, string>;
        if (headers.authorization) {
          headers.authorization = '[REDACTED]';
        }
        if (headers.cookie) {
          headers.cookie = '[REDACTED]';
        }
      }
    }

    return event;
  },
});
