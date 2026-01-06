/**
 * Centralized Logging Service
 * Replaces console.log/warn/error with structured logging
 * Integrates with Sentry for error tracking
 */

import * as Sentry from '@sentry/nextjs';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  userId?: string;
  organizationId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

/**
 * PII fields that should be redacted from logs
 */
const PII_FIELDS = [
  'password',
  'token',
  'apiKey',
  'secret',
  'creditCard',
  'ssn',
  'email', // Debatable - sometimes needed for debugging
  'phone',
  'address',
  'authorization',
  'cookie',
];

/**
 * Redact PII from context before logging
 */
function redactPII(obj: any): any {
  if (!obj || typeof obj !== 'object') {return obj;}
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactPII(item));
  }
  
  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const shouldRedact = PII_FIELDS.some(field => keyLower.includes(field.toLowerCase()));
    
    if (shouldRedact) {
      redacted[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      redacted[key] = redactPII(value);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isTest = process.env.NODE_ENV === 'test';

  /**
   * Log debug information (only in development)
   */
  debug(message: string, context?: LogContext) {
    if (!this.isDevelopment) {return;}
    
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext) {
    if (this.isTest) {return;}
    
    this.log(LogLevel.INFO, message, context);
    
    // Send breadcrumb to Sentry
    Sentry.addBreadcrumb({
      category: 'info',
      message,
      level: 'info',
      data: context,
    });
  }

  /**
   * Log warnings (potential issues)
   */
  warn(message: string, context?: LogContext) {
    if (this.isTest) {return;}
    
    this.log(LogLevel.WARN, message, context);
    
    // Send to Sentry
    Sentry.addBreadcrumb({
      category: 'warning',
      message,
      level: 'warning',
      data: context,
    });
  }

  /**
   * Log errors (critical issues)
   */
  error(message: string, error?: Error | unknown, context?: LogContext) {
    if (this.isTest) {return;}
    
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    this.log(LogLevel.ERROR, message, {
      ...context,
      error: errorObj.message,
      stack: errorObj.stack,
    });
    
    // Send to Sentry with full error details
    Sentry.captureException(errorObj, {
      tags: {
        route: context?.route,
        userId: context?.userId,
        organizationId: context?.organizationId,
      },
      extra: context,
    });
  }

  /**
   * Internal logging implementation
   */
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    
    // Redact PII from context (GDPR/CCPA compliance)
    const safeContext = context ? redactPII(context) : {};
    
    const logData = {
      timestamp,
      level,
      message,
      environment: process.env.NODE_ENV || 'development',
      ...safeContext,
    };

    // In development, use colored console output
    if (this.isDevelopment) {
      const colors = {
        [LogLevel.DEBUG]: '\x1b[36m',  // Cyan
        [LogLevel.INFO]: '\x1b[32m',   // Green
        [LogLevel.WARN]: '\x1b[33m',   // Yellow
        [LogLevel.ERROR]: '\x1b[31m',  // Red
      };
      const reset = '\x1b[0m';
      const color = colors[level];
      
      console.log(
        `${color}[${level.toUpperCase()}]${reset} ${timestamp} - ${message}`,
        context ? context : ''
      );
    } else {
      // In production, output structured JSON logs
      console.log(JSON.stringify(logData));
    }
  }

  /**
   * Create a child logger with default context
   */
  child(defaultContext: LogContext): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

/**
 * Child logger with inherited context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultContext: LogContext
  ) {}

  debug(message: string, context?: LogContext) {
    this.parent.debug(message, { ...this.defaultContext, ...context });
  }

  info(message: string, context?: LogContext) {
    this.parent.info(message, { ...this.defaultContext, ...context });
  }

  warn(message: string, context?: LogContext) {
    this.parent.warn(message, { ...this.defaultContext, ...context });
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    this.parent.error(message, error, { ...this.defaultContext, ...context });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  debug: (msg: string, ctx?: LogContext) => logger.debug(msg, ctx),
  info: (msg: string, ctx?: LogContext) => logger.info(msg, ctx),
  warn: (msg: string, ctx?: LogContext) => logger.warn(msg, ctx),
  error: (msg: string, err?: Error | unknown, ctx?: LogContext) => logger.error(msg, err, ctx),
};

