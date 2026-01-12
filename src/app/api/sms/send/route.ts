import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms/sms-service';
import { requireOrganization } from '@/lib/auth/api-auth';
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
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(smsSendSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = formatValidationErrors(validationError);
      
      return errors.validation('Validation failed', errorDetails);
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
    const result = await sendSMS({
      ...smsData,
      organizationId,
      metadata: { ...smsData.metadata, userId: user.uid },
    } as any);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('SMS send error', error, { route: '/api/sms/send' });
    return errors.externalService('SMS provider', error instanceof Error ? error : undefined);
  }
}

