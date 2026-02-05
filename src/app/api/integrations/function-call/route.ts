/**
 * API endpoint for function calling
 * AI agent calls this to execute integration functions
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { executeFunctionCall } from '@/lib/integrations/function-calling';
import type { FunctionCallRequest } from '@/types/integrations';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

interface RequestPayload {
  integrationId: string;
  functionName: string;
  parameters: Record<string, unknown>;
  conversationId?: string;
  customerId?: string;
  conversationContext?: string;
  userMessage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/function-call');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Penthouse: use default organization ID
    const organizationId = DEFAULT_ORG_ID;

    // Parse request
    const body = await request.json() as RequestPayload;
    const {
      integrationId,
      functionName,
      parameters,
      conversationId,
      customerId,
    } = body;

    if (!integrationId || !functionName || !parameters) {
      return errors.badRequest('Missing required fields');
    }

    // Build function call request
    const functionCallRequest: FunctionCallRequest = {
      conversationId: conversationId ?? '',
      customerId: customerId ?? '',
      integrationId,
      functionName,
      parameters,
      conversationContext: body.conversationContext ?? '',
      userMessage: body.userMessage ?? '',
      timestamp: new Date().toISOString(),
    };

    // Execute the function
    const result = await executeFunctionCall(functionCallRequest, organizationId);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute function';
    logger.error('Error executing function call', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/function-call' });
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        humanReadableResult: 'Sorry, I encountered an error trying to do that.',
        executionTime: 0,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
