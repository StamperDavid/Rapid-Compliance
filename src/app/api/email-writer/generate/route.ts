/**
 * Email Writer API - Generate Email Endpoint
 * 
 * POST /api/email-writer/generate
 * 
 * Generate AI-powered sales emails based on deal context, scoring, and battlecard data.
 * 
 * FEATURES:
 * - Input validation with Zod schemas
 * - Rate limiting (AI_OPERATIONS: 20 req/min)
 * - Deal scoring integration
 * - Battlecard integration for competitive positioning
 * - Industry template integration for best practices
 * - Signal Bus integration for tracking
 * 
 * REQUEST BODY:
 * ```json
 * {
 *   "organizationId": "org_123",
 *   "workspaceId": "workspace_123",
 *   "userId": "user_123",
 *   "emailType": "intro",
 *   "dealId": "deal_123",
 *   "recipientName": "John Doe",
 *   "recipientEmail": "john@example.com",
 *   "companyName": "Example Inc",
 *   "tone": "professional",
 *   "includeCompetitive": true,
 *   "competitorDomain": "https://competitor.com"
 * }
 * ```
 * 
 * RESPONSE:
 * ```json
 * {
 *   "success": true,
 *   "email": {
 *     "id": "email_abc",
 *     "subject": "Quick question about Example Inc",
 *     "body": "<html>...</html>",
 *     "bodyPlain": "Hi John...",
 *     "emailType": "intro",
 *     "dealScore": 75,
 *     "dealTier": "warm"
 *   }
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
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
    // 1. Rate limiting (AI operations: 20 req/min)
    const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.AI_OPERATIONS);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // 2. Parse and validate request body
    const body = await request.json();
    const validation = validateRequestBody(body, GenerateEmailSchema);
    
    if (!validation.success) {
      const { error, details } = validation;
      logger.warn('Invalid email generation request', {
        error,
        details,
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
    
    // 3. Generate email
    logger.info('Generating sales email', {
      organizationId: validData.organizationId,
      dealId: validData.dealId,
      emailType: validData.emailType,
    });
    
    const result = await generateSalesEmail({
      organizationId: validData.organizationId,
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
      logger.error('Email generation failed', {
        error: result.error,
        organizationId: validData.organizationId,
        dealId: validData.dealId,
        duration,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to generate email',
        },
        { status: 500 }
      );
    }
    
    logger.info('Email generated successfully', {
      emailId: result.email?.id,
      organizationId: validData.organizationId,
      dealId: validData.dealId,
      emailType: validData.emailType,
      duration,
    });
    
    // 4. Return generated email
    return NextResponse.json(
      {
        success: true,
        email: result.email,
        suggestedImprovements: result.suggestedImprovements,
      },
      { status: 200 }
    );
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Unexpected error in email generation endpoint', {
      error,
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
