import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/email-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { emailSendSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logging/logger';
import { logApiRequest, logApiError } from '@/lib/logging/api-logger';

export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
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

    // Send email
    const result = await sendEmail({
      ...emailData,
      metadata: { ...emailData.metadata, organizationId, userId: user.uid },
    });

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
    const response = NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    );
    logApiError(request, error, 500);
    await logApiRequest(request, response, startTime);
    return response;
  }
}

