import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { PLATFORM_ID } from '@/lib/constants/platform';

/**
 * Create platform-admin organization
 * Call this once to set up the organization for the landing page
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting (strict - this is a setup route)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/setup/create-platform-org');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const now = new Date();

    // Create organization document
    await FirestoreService.set(
      COLLECTIONS.ORGANIZATIONS,
      PLATFORM_ID,
      {
        id: PLATFORM_ID,
        name: 'SalesVelocity.ai',
        industry: 'AI Sales Automation',
        plan: 'enterprise',
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        settings: {
          timezone: 'America/New_York',
          currency: 'USD'
        }
      },
      true // merge: don't overwrite if exists
    );

    // Enable chat widget
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/settings`,
      'chatWidget',
      {
        enabled: true,
        welcomeMessage: "Hi! I'm Jasper. How can I help you today?",
        primaryColor: '#6366f1',
        position: 'bottom-right',
        updatedAt: now.toISOString()
      },
      true
    );

    // Set default agent config
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/agentConfig`,
      'default',
      {
        selectedModel: 'openrouter/anthropic/claude-3.5-sonnet',
        modelConfig: {
          temperature: 0.7,
          maxTokens: 800,
          topP: 0.9
        },
        updatedAt: now.toISOString()
      },
      true
    );

    return NextResponse.json({
      success: true,
      message: 'Platform organization created successfully!'
    });

  } catch (error: unknown) {
    logger.error('Error creating platform-admin org', error instanceof Error ? error : new Error(String(error)), { route: '/api/setup/create-platform-org' });
    return errors.database('Failed to create platform organization', error instanceof Error ? error : undefined);
  }
}




