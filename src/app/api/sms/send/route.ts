import { type NextRequest, NextResponse } from 'next/server';
import { sendSMS, type SMSOptions } from '@/lib/sms/sms-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { smsSendSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { formatValidationErrors } from '@/lib/validation/error-formatter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/sms/send');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = validateInput(smsSendSchema, body);

    if (!validation.success) {
      // Convert Zod errors to ValidationErrorDetail format
      const zodErrors = validation.errors.errors.map(e => ({
        message: e.message,
        path: e.path.map(String),
      }));
      const errorDetails = formatValidationErrors({ success: false, errors: { errors: zodErrors } });

      return errors.validation('Validation failed', { errors: errorDetails });
    }

    const { organizationId, ...smsData } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return errors.forbidden('Access denied to this organization');
    }

    // Verify required fields
    if (!smsData.to || !smsData.message) {
      return NextResponse.json(
        { success: false, error: 'to and message are required fields' },
        { status: 400 }
      );
    }

    // Send SMS with type assertion after validation
    const smsOptions: SMSOptions = {
      to: smsData.to,
      message: smsData.message,
      organizationId,
      from: smsData.from,
      metadata: { ...smsData.metadata, userId: user.uid },
    };
    const result = await sendSMS(smsOptions);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('SMS send error', error instanceof Error ? error : new Error('Unknown error'), { route: '/api/sms/send' });
    return errors.externalService('SMS provider', error instanceof Error ? error : undefined);
  }
}

