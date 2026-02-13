/**
 * Social OAuth Initiation Route
 * GET /api/social/oauth/auth/[provider]
 *
 * Generates an OAuth authorization URL and redirects the user to the platform.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { socialProviderSchema } from '@/lib/social/social-oauth-schemas';
import {
  generateTwitterAuthUrl,
  generateLinkedInAuthUrl,
} from '@/lib/social/social-oauth-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/oauth/auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Validate provider
    const providerValidation = socialProviderSchema.safeParse(provider);
    if (!providerValidation.success) {
      return errors.badRequest(`Unsupported provider: ${provider}. Must be 'twitter' or 'linkedin'.`);
    }

    const validProvider = providerValidation.data;
    const userId = authResult.user.uid;

    logger.info('Starting social OAuth flow', {
      route: '/api/social/oauth/auth',
      provider: validProvider,
      userId,
    });

    let authUrl: string;

    switch (validProvider) {
      case 'twitter':
        authUrl = await generateTwitterAuthUrl(userId);
        break;
      case 'linkedin':
        authUrl = await generateLinkedInAuthUrl(userId);
        break;
      default: {
        const _exhaustive: never = validProvider;
        return errors.badRequest(`Unsupported provider: ${String(_exhaustive)}`);
      }
    }

    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error(
      'Social OAuth auth initiation error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/social/oauth/auth' }
    );

    const message = error instanceof Error ? error.message : 'OAuth initiation failed';
    if (message.includes('not configured')) {
      return errors.badRequest(message);
    }

    return errors.externalService('OAuth', error instanceof Error ? error : undefined);
  }
}
