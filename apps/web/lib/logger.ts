// Structured logging with Sentry integration
// Requirements: 8.7, 13.7
import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

/**
 * PII fields to redact from logs
 */
const PII_FIELDS = ['email', 'postcode', 'address', 'phone', 'name', 'password', 'token'];

/**
 * Redact PII from log context
 */
function redactPII(context: LogContext): LogContext {
  const redacted = { ...context };
  
  for (const key of Object.keys(redacted)) {
    if (PII_FIELDS.some(field => key.toLowerCase().includes(field))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactPII(redacted[key]);
    }
  }
  
  return redacted;
}

/**
 * Logger class with structured logging and Sentry integration
 */
class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, data?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      const context = redactPII({ ...this.context, ...data });
      console.debug(`[DEBUG] ${message}`, context);
    }
  }

  /**
   * Log info message
   */
  info(message: string, data?: LogContext): void {
    const context = redactPII({ ...this.context, ...data });
    console.info(`[INFO] ${message}`, context);
    
    // Send breadcrumb to Sentry
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      data: context,
    });
  }

  /**
   * Log warning message (sent to Sentry)
   */
  warn(message: string, data?: LogContext): void {
    const context = redactPII({ ...this.context, ...data });
    console.warn(`[WARN] ${message}`, context);
    
    // Send to Sentry as warning
    Sentry.captureMessage(message, {
      level: 'warning',
      contexts: {
        custom: context,
      },
    });
  }

  /**
   * Log error message (sent to Sentry with stack trace)
   */
  error(message: string, error?: Error | unknown, data?: LogContext): void {
    const context = redactPII({ ...this.context, ...data });
    console.error(`[ERROR] ${message}`, error, context);
    
    // Send to Sentry as error
    if (error instanceof Error) {
      Sentry.captureException(error, {
        contexts: {
          custom: {
            message,
            ...context,
          },
        },
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        contexts: {
          custom: {
            error: String(error),
            ...context,
          },
        },
      });
    }
  }

  /**
   * Set user context for Sentry
   */
  setUser(userId: string, email?: string): void {
    Sentry.setUser({
      id: userId,
      // Don't include email in production to avoid PII
      ...(process.env.NODE_ENV === 'development' && email ? { email } : {}),
    });
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    Sentry.setUser(null);
  }

  /**
   * Add tags for filtering in Sentry
   */
  setTags(tags: Record<string, string>): void {
    Sentry.setTags(tags);
  }

  /**
   * Set context for Sentry
   */
  setContext(name: string, context: LogContext): void {
    Sentry.setContext(name, redactPII(context));
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with specific context
 */
export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}
