# 🔧 Sentry Setup Guide

## Overview

Sentry has been integrated into the application for error tracking and monitoring. This guide explains how to set it up.

## Installation

Sentry is already installed via `npm install @sentry/nextjs`.

## Configuration Files

Three Sentry configuration files have been created:

1. **`sentry.client.config.ts`** - Client-side error tracking
2. **`sentry.server.config.ts`** - Server-side error tracking (API routes)
3. **`sentry.edge.config.ts`** - Edge runtime error tracking (middleware)

## Setup Steps

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Sign up for a free account
3. Create a new project
4. Select "Next.js" as the platform

### 2. Get Your DSN

After creating the project, Sentry will provide you with a DSN (Data Source Name). It looks like:
```
https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

### 3. Configure Environment Variables

Add the DSN to your environment variables:

**`.env.local` (for local development):**
```env
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

**Production (GCP Secret Manager or environment variables):**
```env
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

### 4. Deploy

The Sentry configuration is already integrated into `next.config.js`. Once you add the DSN, Sentry will automatically:
- Upload source maps
- Track errors
- Monitor performance
- Record user sessions (replays)

## Features

### Error Tracking

Errors are automatically captured and sent to Sentry:
- Unhandled exceptions
- API route errors
- React component errors (via ErrorBoundary)
- Client-side JavaScript errors

### Performance Monitoring

- API route performance
- Page load times
- Database query times

### Session Replay

- Records user sessions when errors occur
- Helps debug user experience issues

### Source Maps

- Automatically uploads source maps for better error stack traces
- Only in production builds

## Usage in Code

### Manual Error Reporting

```typescript
import * as Sentry from '@sentry/nextjs';

try {
  // Your code
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: 'email-sending',
      organizationId: 'org-123',
    },
    extra: {
      userId: 'user-456',
    },
  });
}
```

### Using the Logger

The structured logger automatically sends errors to Sentry:

```typescript
import { logger } from '@/lib/logging/logger';

logger.error('Failed to send email', {
  organizationId: 'org-123',
  userId: 'user-456',
}, error);
```

### Error Boundaries

The `ErrorBoundary` component is already added to the root layout. It will:
- Catch React component errors
- Display a user-friendly error message
- Send errors to Sentry automatically

## Testing

### Test Error Tracking

1. Add a test error to any API route:
```typescript
throw new Error('Test error for Sentry');
```

2. Trigger the error
3. Check your Sentry dashboard - you should see the error within seconds

### Test Error Boundary

1. Add a test error to a React component:
```typescript
useEffect(() => {
  throw new Error('Test React error');
}, []);
```

2. The ErrorBoundary should catch it and display the error UI

## Monitoring

### Sentry Dashboard

Access your Sentry dashboard at:
- https://sentry.io/organizations/[your-org]/issues/

### Key Metrics to Monitor

1. **Error Rate** - Should be < 1%
2. **Response Time** - P95 should be < 500ms
3. **Error Trends** - Watch for spikes
4. **Affected Users** - Track how many users are impacted

## Best Practices

1. **Don't Log Sensitive Data**
   - The configuration already filters out:
     - Authorization headers
     - API keys
     - Passwords
     - Tokens

2. **Add Context**
   - Always include relevant context when logging errors:
     ```typescript
     Sentry.captureException(error, {
       tags: { feature: 'billing' },
       extra: { organizationId, userId },
     });
     ```

3. **Use Log Levels**
   - Use `logger.error()` for errors
   - Use `logger.warn()` for warnings
   - Use `logger.info()` for informational messages

4. **Monitor Regularly**
   - Check Sentry dashboard daily
   - Set up alerts for critical errors
   - Review error trends weekly

## Troubleshooting

### Errors Not Appearing in Sentry

1. Check that `NEXT_PUBLIC_SENTRY_DSN` is set
2. Check browser console for Sentry initialization errors
3. Verify network requests to Sentry are not blocked
4. Check Sentry project settings

### Source Maps Not Working

1. Ensure `SENTRY_ORG` and `SENTRY_PROJECT` are set
2. Check that source maps are being generated in build
3. Verify Sentry has access to upload source maps

### Too Many Events

1. Adjust `tracesSampleRate` in config files (currently 0.1 = 10%)
2. Use `beforeSend` to filter out unwanted events
3. Set up rate limiting in Sentry project settings

## Cost

Sentry free tier includes:
- 5,000 errors/month
- 10,000 performance units/month
- 1 project
- 30 days of data retention

For production, consider upgrading to:
- **Team Plan**: $26/month - 50K errors, 100K performance units
- **Business Plan**: $80/month - 200K errors, 500K performance units

## Next Steps

1. ✅ Add DSN to environment variables
2. ✅ Deploy to staging and test
3. ✅ Set up alerts in Sentry dashboard
4. ✅ Configure release tracking
5. ✅ Set up performance monitoring alerts

---

**Note**: Sentry will work even without configuration (it just won't send events). This allows the app to run in development without requiring Sentry setup.











