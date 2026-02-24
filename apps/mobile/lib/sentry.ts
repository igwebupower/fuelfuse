// Sentry configuration for React Native
// Requirements: 13.7
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Initialize Sentry for error tracking
 */
export function initSentry() {
  const dsn = Constants.expoConfig?.extra?.sentryDsn;

  if (!dsn) {
    console.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    debug: __DEV__,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    beforeSend(event) {
      // Redact PII from events
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
}

/**
 * Log error to Sentry
 */
export function logError(error: Error, context?: Record<string, any>) {
  console.error('Error:', error);
  
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

/**
 * Log message to Sentry
 */
export function logMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for Sentry
 */
export function setUserContext(userId: string) {
  Sentry.setUser({ id: userId });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}
