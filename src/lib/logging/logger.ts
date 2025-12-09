/**
 * Structured Logging Service
 * Provides consistent logging across the application
 * Integrates with Cloud Logging for production
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogContext {
  userId?: string;
  organizationId?: string;
  workspaceId?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Log a message with structured data
   */
  private log(
    level: LogLevel,
    message: string,
    context: LogContext = {},
    error?: Error
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
        },
      }),
    };

    // In development, use console
    if (this.isDevelopment) {
      const consoleMethod = level === LogLevel.ERROR || level === LogLevel.CRITICAL
        ? console.error
        : level === LogLevel.WARN
        ? console.warn
        : console.log;

      consoleMethod(`[${level}]`, message, context, error || '');
      return;
    }

    // In production, send to Cloud Logging
    if (this.isProduction) {
      this.sendToCloudLogging(logEntry);
    }
  }

  /**
   * Send log to Cloud Logging (GCP)
   */
  private async sendToCloudLogging(logEntry: any) {
    try {
      // In production, you would use @google-cloud/logging
      // For now, we'll use console with structured format
      console.log(JSON.stringify(logEntry));
      
      // TODO: Integrate with @google-cloud/logging
      // const { Logging } = require('@google-cloud/logging');
      // const logging = new Logging();
      // const log = logging.log('app-logs');
      // await log.write(log.entry(logEntry));
    } catch (error) {
      // Fallback to console if Cloud Logging fails
      console.error('Failed to send log to Cloud Logging:', error);
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, context: LogContext = {}) {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context: LogContext = {}) {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context: LogContext = {}, error?: Error) {
    this.log(LogLevel.WARN, message, context, error);
  }

  /**
   * Error level logging
   */
  error(message: string, context: LogContext = {}, error?: Error) {
    this.log(LogLevel.ERROR, message, context, error);
    
    // Also send to Sentry for error tracking
    if (typeof window !== 'undefined') {
      // Client-side
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureException(error || new Error(message), {
          tags: context,
        });
      }).catch(() => {
        // Sentry not available
      });
    } else {
      // Server-side
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureException(error || new Error(message), {
          tags: context,
        });
      }).catch(() => {
        // Sentry not available
      });
    }
  }

  /**
   * Critical level logging
   */
  critical(message: string, context: LogContext = {}, error?: Error) {
    this.log(LogLevel.CRITICAL, message, context, error);
    
    // Always send critical errors to Sentry
    if (typeof window !== 'undefined') {
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureException(error || new Error(message), {
          level: 'fatal',
          tags: context,
        });
      }).catch(() => {
        // Sentry not available
      });
    } else {
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureException(error || new Error(message), {
          level: 'fatal',
          tags: context,
        });
      }).catch(() => {
        // Sentry not available
      });
    }
  }

  /**
   * Log API request
   */
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context: LogContext = {}
  ) {
    this.info(`${method} ${path}`, {
      ...context,
      httpMethod: method,
      httpPath: path,
      httpStatus: statusCode,
      durationMs: duration,
    });
  }

  /**
   * Log API error
   */
  logApiError(
    method: string,
    path: string,
    statusCode: number,
    error: Error,
    context: LogContext = {}
  ) {
    this.error(`${method} ${path} failed`, {
      ...context,
      httpMethod: method,
      httpPath: path,
      httpStatus: statusCode,
    }, error);
  }
}

// Export singleton instance
export const logger = new Logger();











