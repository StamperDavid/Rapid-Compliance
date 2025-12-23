import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/email-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { emailSendSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logging/logger';
import { logApiRequest, logApiError } from '@/lib/logging/api-logger';
import { errors } from '@/lib/middleware/error-handler';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/email/send');
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
    const validation = validateInput(emailSendSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const { organizationId, ...emailData } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      const response = NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
      await logApiRequest(request, response, startTime, {
        organizationId,
        userId: user.uid,
      });
      return response;
    }

    // Verify required email fields
    if (!emailData.to || !emailData.subject) {
      return NextResponse.json(
        { success: false, error: 'to and subject are required fields' },
        { status: 400 }
      );
    }

    // Send email with type assertion after validation
    const result = await sendEmail({
      ...emailData,
      metadata: { ...emailData.metadata, organizationId, userId: user.uid },
    } as any);

    if (!result.success) {
      const response = NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
      await logApiRequest(request, response, startTime, {
        organizationId,
        userId: user.uid,
      });
      return response;
    }

    const response = NextResponse.json(result);
    await logApiRequest(request, response, startTime, {
      organizationId,
      userId: user.uid,
    });
    return response;
  } catch (error: any) {
    logApiError(request, error, 500);
    
    // Handle specific email errors
    let response;
    
    if (error?.message?.includes('API key')) {
      response = errors.badRequest('SendGrid API key not configured');
    } else if (error?.message?.includes('Invalid email')) {
      response = errors.badRequest('Invalid email address');
    } else if (error?.code === 'ECONNREFUSED') {
      response = errors.internal('Email service unavailable', error);
    } else {
      response = errors.internal('Failed to send email', error);
    }
    
    await logApiRequest(request, response, startTime);
    return response;
  }
}

