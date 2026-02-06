import { type NextRequest, NextResponse } from 'next/server';
import { createCampaign, sendCampaign, getCampaignStats, listCampaigns } from '@/lib/email/campaign-manager';
import { requireAuth } from '@/lib/auth/api-auth';
import { campaignActionSchema, validateInput, organizationIdSchema } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

interface ValidationError {
  path?: string[];
  message?: string;
}

interface ValidationFailure {
  success: false;
  errors?: {
    errors?: ValidationError[];
  };
}

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user: _user } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const campaignId = searchParams.get('campaignId');

    if (!organizationId) {
      return errors.badRequest('organizationId is required');
    }

    const orgValidation = organizationIdSchema.safeParse(organizationId);
    if (!orgValidation.success) {
      return errors.badRequest('Invalid organizationId format');
    }

    // Verify user has access to this organization
    if (DEFAULT_ORG_ID !== organizationId) {
      return errors.forbidden('Access denied to this organization');
    }

    if (campaignId) {
      // Get specific campaign stats
      const stats = await getCampaignStats(campaignId);
      if (!stats) {
        return errors.notFound('Campaign not found');
      }
      return NextResponse.json({ success: true, stats });
    } else {
      // List all campaigns with pagination
      const limit = parseInt(searchParams.get('limit') ?? '50');
      const cursor = searchParams.get('cursor') ?? undefined;
      const result = await listCampaigns(organizationId, limit, cursor);
      return NextResponse.json({
        success: true,
        campaigns: result.campaigns,
        pagination: {
          hasMore: result.hasMore,
          pageSize: result.campaigns.length,
        },
      });
    }
  } catch (error: unknown) {
    logger.error('Campaign fetch error', error instanceof Error ? error : new Error(String(error)), { route: '/api/email/campaigns' });
    return errors.database('Failed to fetch campaigns', error instanceof Error ? error : undefined);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/email/campaigns');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = validateInput(campaignActionSchema, body);

    if (!validation.success) {
      const validationError = validation as ValidationFailure;
      const errorDetails = validationError.errors?.errors?.map((e: ValidationError) => {
        const joinedPath = e.path?.join('.');
        return {
          path: joinedPath ?? 'unknown',
          message: e.message ?? 'Validation error',
        };
      }) ?? [];

      return errors.validation('Validation failed', { errors: errorDetails });
    }

    const { action, campaign, campaignId, organizationId } = validation.data;

    // Verify user has access to this organization
    if (DEFAULT_ORG_ID !== organizationId) {
      return errors.forbidden('Access denied to this organization');
    }

    if (action === 'create') {
      if (!campaign) {
        return errors.badRequest('Campaign data is required');
      }

      const newCampaign = await createCampaign({
        ...campaign,
        organizationId,
        createdBy: user.uid,
      });
      return NextResponse.json({ success: true, campaign: newCampaign });
    }

    if (action === 'send') {
      if (!campaignId) {
        return errors.badRequest('campaignId is required');
      }

      const result = await sendCampaign(campaignId);
      if (!result.success) {
        return errors.badRequest(result.error ?? 'Failed to send campaign');
      }

      return NextResponse.json({ success: true });
    }

    return errors.badRequest('Invalid action. Use: create or send');
  } catch (error: unknown) {
    logger.error('Campaign processing error', error instanceof Error ? error : new Error(String(error)), { route: '/api/email/campaigns' });
    return errors.database('Failed to process campaign', error instanceof Error ? error : undefined);
  }
}
