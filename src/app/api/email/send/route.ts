import { type NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/email-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { validateEmailCompliance, ensureCompliance } from '@/lib/compliance/can-spam-service';
import { emailSendSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logApiRequest, logApiError } from '@/lib/logging/api-logger';
import { errors } from '@/lib/middleware/error-handler';

export const dynamic = 'force-dynamic';

interface ValidationError {
  path?: string[];
  message?: string;
}

interface ValidationFailure {
  success: false;
  errors?: {
    errors?: ValidationError[];
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/email/send');
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
    const validation = validateInput(emailSendSchema, body);

    if (!validation.success) {
      const validationError = validation as ValidationFailure;
      const errorDetails = validationError.errors?.errors?.map((e: ValidationError) => {
        const joinedPath = e.path?.join('.');
        return {
          path: joinedPath ?? 'unknown',
          message: e.message ?? 'Validation error',
        };
      }) ?? [];

      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const emailData = validation.data;

    // Verify required email fields
    if (!emailData.to || !emailData.subject) {
      return NextResponse.json(
        { success: false, error: 'to and subject are required fields' },
        { status: 400 }
      );
    }

    // CAN-SPAM compliance check
    const emailMetadata = emailData.metadata as Record<string, unknown> | undefined;
    const compliance = validateEmailCompliance({
      unsubscribeUrl: typeof emailMetadata?.unsubscribeUrl === 'string' ? emailMetadata.unsubscribeUrl : undefined,
      physicalAddress: typeof emailMetadata?.physicalAddress === 'string' ? emailMetadata.physicalAddress : undefined,
      fromAddress: typeof emailData.from === 'string' ? emailData.from : undefined,
    });

    if (!compliance.compliant) {
      return NextResponse.json(
        {
          success: false,
          error: 'CAN-SPAM compliance violation',
          violations: compliance.violations,
        },
        { status: 400 }
      );
    }

    // MAJ-29: Ensure HTML content includes required CAN-SPAM footer
    const contactId = typeof emailMetadata?.contactId === 'string' ? emailMetadata.contactId : 'unknown';
    const emailId = typeof emailMetadata?.emailId === 'string' ? emailMetadata.emailId : undefined;
    const compliantHtml = typeof emailData.html === 'string'
      ? ensureCompliance(emailData.html, contactId, emailId)
      : emailData.html;

    // Send email with type assertion after validation
    const result = await sendEmail({
      ...emailData,
      html: compliantHtml,
      metadata: { ...emailData.metadata, userId: user.uid },
    } as Parameters<typeof sendEmail>[0]);

    if (!result.success) {
      const response = NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
      logApiRequest(request, response, startTime, {
        userId: user.uid,
      });
      return response;
    }

    const response = NextResponse.json(result);
    logApiRequest(request, response, startTime, {
      userId: user.uid,
    });
    return response;
  } catch (error: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logApiError(request, errorObj, 500);

    // Handle specific email errors
    let response;
    const errorMessage = errorObj.message;
    const errorCode = (error as { code?: string })?.code;

    if (errorMessage.includes('API key')) {
      response = errors.badRequest('SendGrid API key not configured');
    } else if (errorMessage.includes('Invalid email')) {
      response = errors.badRequest('Invalid email address');
    } else if (errorCode === 'ECONNREFUSED') {
      response = errors.internal('Email service unavailable', errorObj);
    } else {
      response = errors.internal('Failed to send email', errorObj);
    }

    logApiRequest(request, response, startTime);
    return response;
  }
}
