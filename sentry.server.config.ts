/**
 * Sentry Server Configuration
 * Error tracking for server-side errors (API routes, server components)
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Enable profiling (requires tracesSampleRate to be set)
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  
  // Debug mode
  debug: process.env.NODE_ENV === 'development',
  
  // Environment
  environment: process.env.NODE_ENV || 'development',
  
  // Release version (use git commit SHA in production)
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  
  // Server name (for multi-server deployments)
  serverName: process.env.VERCEL_REGION || process.env.HOSTNAME || 'unknown',
  
  // Max breadcrumbs to keep
  maxBreadcrumbs: 50,
  
  // Attach stack trace to messages
  attachStacktrace: true,
  
  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events if Sentry is not configured
    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return null;
    }
    
    // Don't send health check errors
    if (event.request?.url?.includes('/api/health')) {
      return null;
    }
    
    // Don't send rate limit errors (these are expected)
    if (event.exception?.values?.[0]?.value?.includes('Rate limit')) {
      return null;
    }
    
    // Filter out sensitive information
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
        delete event.request.headers['stripe-signature'];
      }
      
      // Remove sensitive query params
      if (event.request.query_string) {
        const params = new URLSearchParams(event.request.query_string);
        params.delete('token');
        params.delete('apiKey');
        params.delete('secret');
        params.delete('code'); // OAuth codes
        event.request.query_string = params.toString();
      }
      
      // Remove sensitive body data
      if (event.request.data) {
        const data = event.request.data as any;
        if (typeof data === 'object' && data !== null) {
          delete data.password;
          delete data.secretKey;
          delete data.apiKey;
          delete data.token;
          delete data.accessToken;
          delete data.refreshToken;
          delete data.privateKey;
        }
      }
    }
    
    // Add server context
    event.contexts = event.contexts || {};
    event.contexts.runtime = {
      name: 'node',
      version: process.version,
    };
    
    return event;
  },
  
  // Ignore specific errors
  ignoreErrors: [
    // Browser errors that shouldn't happen server-side
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    // Network errors
    'NetworkError',
    'Network request failed',
    // Firebase quota exceeded (expected in dev)
    'Quota exceeded',
  ],
  
  // Sample rate for error events (1.0 = all errors)
  sampleRate: 1.0,
  
  // Server-side integrations
  integrations: [
    // HTTP integration is automatically included in Next.js
    // No need to manually add
  ],
});


