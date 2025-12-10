/**
 * API endpoint for function calling
 * AI agent calls this to execute integration functions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { executeFunctionCall } from '@/lib/integrations/function-calling';
import type { FunctionCallRequest } from '@/types/integrations';

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse request
    const body = await request.json();
    const {
      integrationId,
      functionName,
      parameters,
      conversationId,
      customerId,
    } = body;

    if (!integrationId || !functionName || !parameters) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Build function call request
    const functionCallRequest: FunctionCallRequest = {
      organizationId: user.organizationId!,
      conversationId: conversationId || '',
      customerId: customerId || '',
      integrationId,
      functionName,
      parameters,
      conversationContext: body.conversationContext || '',
      userMessage: body.userMessage || '',
      timestamp: new Date().toISOString(),
    };

    // Execute the function
    const result = await executeFunctionCall(functionCallRequest);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing function call:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute function',
        humanReadableResult: 'Sorry, I encountered an error trying to do that.',
        executionTime: 0,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}











