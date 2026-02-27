/**
 * API endpoint for function calling
 * AI agent calls this to execute integration functions
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { executeFunctionCall } from '@/lib/integrations/function-calling';
import type { FunctionCallRequest } from '@/types/integrations';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const FunctionCallSchema = z.object({
  integrationId: z.string().min(1),
  functionName: z.string().min(1),
  parameters: z.record(z.unknown()),
  conversationId: z.string().optional(),
  customerId: z.string().optional(),
  conversationContext: z.string().optional(),
  userMessage: z.string().optional(),
});

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

    // Parse and validate request
    const body: unknown = await request.json();
    const parsed = FunctionCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      integrationId,
      functionName,
      parameters,
      conversationId,
      customerId,
      conversationContext,
      userMessage,
    } = parsed.data;

    // Build function call request
    const functionCallRequest: FunctionCallRequest = {
      conversationId: conversationId ?? '',
      customerId: customerId ?? '',
      integrationId,
      functionName,
      parameters,
      conversationContext: conversationContext ?? '',
      userMessage: userMessage ?? '',
      timestamp: new Date().toISOString(),
    };

    // Execute the function
    const result = await executeFunctionCall(functionCallRequest);

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
