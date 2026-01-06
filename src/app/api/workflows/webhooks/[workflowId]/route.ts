import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/workflows/triggers/webhook-trigger';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * Webhook receiver endpoint
 * Receives webhook requests and triggers workflows
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    // Rate limiting (higher limit for webhooks)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/workflows/webhooks');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const workflowId = params.workflowId;
    const method = request.method;
    const headers = Object.fromEntries(request.headers.entries());
    const body = await request.json().catch(() => ({}));
    
    // Get webhook URL from request
    const webhookUrl = request.url;
    
    // Parse query parameters from URL
    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    
    // Handle webhook
    await handleWebhook(webhookUrl, method, headers, body, queryParams);
    
    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed',
    });
  } catch (error: any) {
    logger.error('Error handling webhook', error, { route: '/api/workflows/webhooks' });
    return errors.internal('Failed to process webhook', error);
  }
}

/**
 * GET endpoint for webhook verification (some services use GET)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  // Some webhook providers verify with GET
  return NextResponse.json({
    success: true,
    message: 'Webhook endpoint active',
    workflowId: params.workflowId,
  });
}



















