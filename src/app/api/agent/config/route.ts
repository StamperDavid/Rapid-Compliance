import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET: Load agent configuration
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/config');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return errors.badRequest('Organization ID required');
    }

    // Get agent configuration
    const agentConfig = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
      'default'
    );

    if (!agentConfig) {
      // Return defaults if no config exists (single model - ensemble removed for MVP)
      return NextResponse.json({
        success: true,
        selectedModel: 'gpt-4-turbo',
        modelConfig: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...(agentConfig as any),
    });
  } catch (error: any) {
    logger.error('Error loading agent config', error, { route: '/api/agent/config' });
    return errors.database('Failed to load configuration', error);
  }
}

/**
 * POST: Save agent configuration
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/config');
    if (rateLimitResponse) {return rateLimitResponse;}

    const body = await request.json();
    const { orgId, selectedModel, modelConfig } = body;

    if (!orgId) {
      return errors.badRequest('Organization ID required');
    }

    // Save agent configuration (single model - ensemble removed for MVP)
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
      'default',
      {
        selectedModel:(selectedModel !== '' && selectedModel != null) ? selectedModel : 'gpt-4-turbo',
        modelConfig:modelConfig ?? {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
        },
        updatedAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.json({
      success: true,
      message: 'AI configuration saved successfully',
    });
  } catch (error: any) {
    logger.error('Error saving agent config', error, { route: '/api/agent/config' });
    return errors.database('Failed to save configuration', error);
  }
}

