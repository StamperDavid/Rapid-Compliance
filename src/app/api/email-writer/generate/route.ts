/**
 * Email Writer API - Generate Email Endpoint
 *
 * POST /api/email-writer/generate
 *
 * Generate AI-powered sales emails based on deal context, scoring, and battlecard data.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';
import { generateSalesEmail, GenerateEmailSchema, validateRequestBody } from '@/lib/email-writer/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/email-writer/generate
 *
 * Generate AI-powered sales email
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authentication (required)
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // 2. Rate limiting (AI operations: 20 req/min)
    const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.AI_OPERATIONS);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 3. Parse and validate request body
    const body: unknown = await request.json();
    const validation = validateRequestBody(body, GenerateEmailSchema);

    if (validation.success === false) {
      const { error, details } = validation;
      logger.warn('Invalid email generation request', {
        error: String(error),
        details: details ? JSON.stringify(details) : undefined,
      });

      return NextResponse.json(
        {
          success: false,
          error,
          details,
        },
        { status: 400 }
      );
    }

    const validData = validation.data;

    // 4. Generate email
    logger.info('Generating sales email', {
      dealId: validData.dealId,
      emailType: validData.emailType,
    });

    const result = await generateSalesEmail({
      workspaceId: validData.workspaceId,
      userId: validData.userId,
      emailType: validData.emailType,
      dealId: validData.dealId,
      recipientName: validData.recipientName,
      recipientEmail: validData.recipientEmail,
      recipientTitle: validData.recipientTitle,
      companyName: validData.companyName,
      competitorDomain: validData.competitorDomain,
      templateId: validData.templateId,
      tone: validData.tone,
      length: validData.length,
      includeCompetitive: validData.includeCompetitive,
      includeSocialProof: validData.includeSocialProof,
      customInstructions: validData.customInstructions,
    });

    const duration = Date.now() - startTime;

    if (!result.success) {
      logger.error('Email generation failed', undefined, {
        error: result.error,
        dealId: validData.dealId,
        duration,
      });

      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Failed to generate email',
        },
        { status: 500 }
      );
    }

    logger.info('Email generated successfully', {
      emailId: result.email?.id,
      dealId: validData.dealId,
      emailType: validData.emailType,
      duration,
    });

    // 5. Return generated email
    return NextResponse.json(
      {
        success: true,
        email: result.email,
        suggestedImprovements: result.suggestedImprovements,
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    logger.error('Unexpected error in email generation endpoint', error instanceof Error ? error : new Error(String(error)), {
      duration,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
