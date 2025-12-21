import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/workflows/triggers/webhook-trigger';

/**
 * Webhook receiver endpoint
 * Receives webhook requests and triggers workflows
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const workflowId = params.workflowId;
    const method = request.method;
    const headers = Object.fromEntries(request.headers.entries());
    const body = await request.json().catch(() => ({}));
    
    // Get webhook URL from request
    const webhookUrl = request.url;
    
    // Handle webhook
    await handleWebhook(webhookUrl, method, headers, body);
    
    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed',
    });
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process webhook' },
      { status: 500 }
    );
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


















