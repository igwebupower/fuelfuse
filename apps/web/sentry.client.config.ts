// Sentry client-side configuration
// Requirements: 8.7, 13.7
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

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

    // Redact PII from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.data) {
          const data = { ...breadcrumb.data };
          const piiFields = ['email', 'postcode', 'address', 'phone', 'name', 'password', 'token'];
          
          for (const key of Object.keys(data)) {
            if (piiFields.some(field => key.toLowerCase().includes(field))) {
              data[key] = '[REDACTED]';
            }
          }
          
          breadcrumb.data = data;
        }
        return breadcrumb;
      });
    }

    return event;
  },
});
