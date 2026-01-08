/**
 * Email Writer API - Send Email Endpoint
 * 
 * POST /api/email-writer/send
 * 
 * Send previously generated emails or generate and send in one step.
 * 
 * FEATURES:
 * - Send via SendGrid
 * - HTML email templates
 * - Open and click tracking
 * - Delivery status tracking
 * - Signal Bus integration
 * - Rate limiting (AI_OPERATIONS: 20 req/min)
 * 
 * REQUEST BODY:
 * ```json
 * {
 *   "organizationId": "org_123",
 *   "workspaceId": "workspace_123",
 *   "userId": "user_123",
 *   "to": "john@example.com",
 *   "toName": "John Doe",
 *   "subject": "Quick question",
 *   "body": "Email body HTML",
 *   "bodyPlain": "Email body plain text",
 *   "dealId": "deal_123",
 *   "emailId": "email_abc",
 *   "trackOpens": true,
 *   "trackClicks": true
 * }
 * ```
 * 
 * RESPONSE:
 * ```json
 * {
 *   "success": true,
 *   "deliveryId": "delivery_xyz",
 *   "messageId": "sendgrid_message_id",
 *   "sentAt": "2026-01-02T12:00:00Z"
 * }
 * ```
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';
import { sendEmail } from '@/lib/email-writer/email-delivery-service';
import { wrapEmailBody, stripHTML } from '@/lib/email-writer/email-html-templates';

export const dynamic = 'force-dynamic';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const SendEmailSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  
  // Recipients
  to: z.string().email('Valid recipient email is required'),
  toName: z.string().optional(),
  
  // Content
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be 200 characters or less'),
  body: z.string().min(1, 'Email body is required'),
  bodyPlain: z.string().optional(), // Optional - will be auto-generated if not provided
  
  // Tracking
  trackOpens: z.boolean().optional().default(true),
  trackClicks: z.boolean().optional().default(true),
  
  // Context
  dealId: z.string().optional(),
  emailId: z.string().optional(),
  campaignId: z.string().optional(),
  
  // Reply-to
  replyTo: z.string().email().optional(),
  replyToName: z.string().optional(),
  
  // Branding
  branding: z.object({
    logo: z.string().url().optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    companyName: z.string().optional(),
  }).optional(),
  
  // Footer
  footer: z.object({
    companyName: z.string().optional(),
    address: z.string().optional(),
    unsubscribeLink: z.string().url().optional(),
  }).optional(),
});

type SendEmailRequest = z.infer<typeof SendEmailSchema>;

// ============================================================================
// API ENDPOINT
// ============================================================================

/**
 * POST /api/email-writer/send
 * 
 * Send sales email
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
    const validation = SendEmailSchema.safeParse(body);
    
    if (!validation.success) {
      logger.warn('Invalid send email request', {
        errors: validation.error.errors,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }
    
    const validData: SendEmailRequest = validation.data;
    
    // 3. Wrap email body with HTML template
    const htmlBody = wrapEmailBody(validData.body, {
      subject: validData.subject,
      footer: validData.footer,
      branding: validData.branding,
    });
    
    // 4. Generate plain text version if not provided
    const plainTextBody =validData.bodyPlain ?? stripHTML(htmlBody);
    
    // 5. Send email
    logger.info('Sending sales email', {
      organizationId: validData.organizationId,
      to: validData.to,
      dealId: validData.dealId,
      emailId: validData.emailId,
    });
    
    const result = await sendEmail({
      organizationId: validData.organizationId,
      workspaceId: validData.workspaceId,
      userId: validData.userId,
      to: validData.to,
      toName: validData.toName,
      subject: validData.subject,
      html: htmlBody,
      text: plainTextBody,
      trackOpens: validData.trackOpens,
      trackClicks: validData.trackClicks,
      dealId: validData.dealId,
      emailId: validData.emailId,
      campaignId: validData.campaignId,
      replyTo: validData.replyTo,
      replyToName: validData.replyToName,
    });
    
    const duration = Date.now() - startTime;
    
    if (!result.success) {
      logger.error('Email sending failed', {
        error: result.error,
        organizationId: validData.organizationId,
        to: validData.to,
        deliveryId: result.deliveryId,
        duration,
      });
      
      return NextResponse.json(
        {
          success: false,
          error:(result.error !== '' && result.error != null) ? result.error : 'Failed to send email',
          deliveryId: result.deliveryId,
        },
        { status: 500 }
      );
    }
    
    logger.info('Email sent successfully', {
      deliveryId: result.deliveryId,
      messageId: result.messageId,
      organizationId: validData.organizationId,
      to: validData.to,
      duration,
    });
    
    // 6. Return delivery result
    return NextResponse.json(
      {
        success: true,
        deliveryId: result.deliveryId,
        messageId: result.messageId,
        sentAt: result.sentAt,
      },
      { status: 200 }
    );
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Unexpected error in send email endpoint', {
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
