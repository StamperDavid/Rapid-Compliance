/**
 * Sentry Client Configuration
 * Error tracking for browser-side errors
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',
  
  // Replay can be used to record user sessions
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events if Sentry is not configured
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return null;
    }
    
    // Filter out sensitive information
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Remove sensitive query params
      if (event.request.query_string) {
        const params = new URLSearchParams(event.request.query_string);
        params.delete('token');
        params.delete('apiKey');
        event.request.query_string = params.toString();
      }
    }
    
    return event;
  },
  
  // Environment
  environment: process.env.NODE_ENV || 'development',
  
  // Release version
  release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
});


