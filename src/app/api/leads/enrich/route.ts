import { type NextRequest, NextResponse } from 'next/server';
import { enrichLead } from '@/lib/analytics/lead-nurturing';
import { requireOrganization } from '@/lib/auth/api-auth';
import { leadEnrichSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

interface ZodIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

interface ValidationFailure {
  success: false;
  errors: {
    errors: ZodIssue[];
  };
}

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
    const body: unknown = await request.json();
    const validation = validateInput(leadEnrichSchema, body);

    if (!validation.success) {
      const validationError = validation as ValidationFailure;
      const errorDetails = validationError.errors?.errors?.map((e: ZodIssue) => {
        const joinedPath = e.path?.join('.');
        return {
          path: (joinedPath !== '' && joinedPath != null) ? joinedPath : 'unknown',
          message: (e.message !== '' && e.message != null) ? e.message : 'Validation error',
        };
      }) ?? [];

      return errors.validation('Validation failed', errorDetails);
    }

    const { organizationId, leadId, sources } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return errors.forbidden('Access denied to this organization');
    }

    const enrichment = await enrichLead(leadId, organizationId, sources ?? {});

    return NextResponse.json({ success: true, enrichment });
  } catch (error) {
    logger.error('Lead enrichment error', error instanceof Error ? error : undefined, { route: '/api/leads/enrich' });
    return errors.externalService('Enrichment service', error instanceof Error ? error : undefined);
  }
}
