import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { enrichLead } from '@/lib/analytics/lead-nurturing';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { leadEnrichSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/leads/enrich');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(leadEnrichSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return errors.validation('Validation failed', errorDetails);
    }

    const { organizationId, leadId, sources } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return errors.forbidden('Access denied to this organization');
    }

    const enrichment = await enrichLead(leadId, organizationId, sources ?? {});

    return NextResponse.json({ success: true, enrichment });
  } catch (error: any) {
    logger.error('Lead enrichment error', error, { route: '/api/leads/enrich' });
    return errors.externalService('Enrichment service', error);
  }
}
