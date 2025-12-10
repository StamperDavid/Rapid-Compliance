# 📊 Structured Logging Setup Guide

## Overview

A structured logging system has been implemented to provide consistent logging across the application. It integrates with:
- **Console** (development)
- **Cloud Logging** (production - GCP)
- **Sentry** (error tracking)

## Logger Service

The logger is located at `src/lib/logging/logger.ts` and provides:

### Log Levels

- **DEBUG** - Detailed debugging information
- **INFO** - General informational messages
- **WARN** - Warning messages
- **ERROR** - Error messages (also sent to Sentry)
- **CRITICAL** - Critical errors (always sent to Sentry)

### Usage

```typescript
import { logger } from '@/lib/logging/logger';

// Info log
logger.info('User logged in', {
  userId: 'user-123',
  organizationId: 'org-456',
});

// Warning log
logger.warn('Rate limit approaching', {
  userId: 'user-123',
  requestsRemaining: 5,
});

// Error log (automatically sent to Sentry)
logger.error('Failed to send email', {
  organizationId: 'org-456',
  emailId: 'email-789',
}, error);

// Critical log (always sent to Sentry)
logger.critical('Database connection lost', {
  organizationId: 'org-456',
}, error);
```

## API Request Logging

The API logger (`src/lib/logging/api-logger.ts`) automatically logs all API requests:

```typescript
import { logApiRequest, logApiError } from '@/lib/logging/api-logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    // ... your code ...
    const response = NextResponse.json(result);
    await logApiRequest(request, response, startTime, {
      organizationId,
      userId,
    });
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    logApiError(request, error, 500, { organizationId });
    await logApiRequest(request, response, startTime);
    return response;
  }
}
```

## Log Format

All logs are structured JSON in production:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "User logged in",
  "userId": "user-123",
  "organizationId": "org-456",
  "httpMethod": "POST",
  "httpPath": "/api/email/send",
  "httpStatus": 200,
  "durationMs": 150
}
```

## Development vs Production

### Development
- Logs to console with colors and formatting
- Includes full error stack traces
- Easy to read and debug

### Production
- Logs as structured JSON
- Sent to Cloud Logging (GCP)
- Errors automatically sent to Sentry
- Filtered for sensitive data

## Cloud Logging Integration

### Setup (Production)

1. **Install Cloud Logging SDK** (optional - currently using console fallback):
```bash
npm install @google-cloud/logging
```

2. **Update logger.ts** to use Cloud Logging:
```typescript
import { Logging } from '@google-cloud/logging';

const logging = new Logging();
const log = logging.log('app-logs');
```

3. **Set up GCP credentials**:
   - Use service account with Cloud Logging permissions
   - Or use default credentials in GCP environment

### Log Queries

Query logs in GCP Console:
```
resource.type="cloud_run_revision"
jsonPayload.level="ERROR"
jsonPayload.organizationId="org-123"
```

## Best Practices

### 1. Always Include Context

```typescript
// Good
logger.info('Email sent', {
  organizationId: 'org-123',
  userId: 'user-456',
  emailId: 'email-789',
});

// Bad
logger.info('Email sent');
```

### 2. Use Appropriate Log Levels

```typescript
logger.debug('Processing email queue'); // Detailed debugging
logger.info('Email queue processed'); // General info
logger.warn('Email queue size is high'); // Warning
logger.error('Failed to process email', {}, error); // Error
logger.critical('Database connection lost', {}, error); // Critical
```

### 3. Don't Log Sensitive Data

The logger automatically filters:
- Passwords
- API keys
- Tokens
- Authorization headers

But be careful with:
- Email addresses (can be PII)
- Phone numbers (can be PII)
- Personal information

### 4. Use Structured Data

```typescript
// Good - structured
logger.info('User action', {
  action: 'email_sent',
  userId: 'user-123',
  organizationId: 'org-456',
  metadata: {
    emailCount: 5,
    campaignId: 'campaign-789',
  },
});

// Bad - string concatenation
logger.info(`User ${userId} sent ${emailCount} emails in campaign ${campaignId}`);
```

## Log Retention

- **Development**: Console logs (no retention)
- **Production**: Cloud Logging (30 days default, configurable)
- **Errors**: Sentry (30 days free tier, longer on paid plans)

## Monitoring

### View Logs

1. **Development**: Check console output
2. **Production**: 
   - GCP Cloud Logging Console
   - Sentry dashboard (for errors)

### Set Up Alerts

1. **GCP Cloud Monitoring**:
   - Alert on error rate > threshold
   - Alert on critical log entries
   - Alert on slow API responses

2. **Sentry**:
   - Alert on new errors
   - Alert on error rate spikes
   - Alert on affected users

## Performance Considerations

- Logging is asynchronous (doesn't block requests)
- Errors are sent to Sentry in background
- Cloud Logging uses batch writes
- Console logging is synchronous but fast

## Next Steps

1. ✅ Logger is ready to use
2. ⏳ Update all API routes to use logging (example in `/api/email/send`)
3. ⏳ Set up Cloud Logging in production
4. ⏳ Configure log retention policies
5. ⏳ Set up monitoring alerts

---

**Note**: The logger works without Cloud Logging configured (uses console fallback). This allows the app to run in development without requiring GCP setup.












