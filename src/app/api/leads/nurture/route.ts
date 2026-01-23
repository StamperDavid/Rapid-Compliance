import { type NextRequest, NextResponse } from 'next/server';
import { createNurtureSequence, enrollLeadInSequence, analyzeLeadLifecycle, getLeadAttribution, type LeadNurtureSequence } from '@/lib/analytics/lead-nurturing';
import { requireOrganization } from '@/lib/auth/api-auth';
import { leadNurtureSchema, validateInput } from '@/lib/validation/schemas';
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
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/leads/nurture');
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
    const validation = validateInput(leadNurtureSchema, body);

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

    const { action, data, organizationId } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'create-sequence': {
        if (!data.sequence) {
          return errors.badRequest('Sequence data is required');
        }
        const sequenceData = data.sequence as Partial<LeadNurtureSequence>;
        const sequence = await createNurtureSequence({
          ...sequenceData,
          organizationId,
          createdBy: user.uid,
        });
        return NextResponse.json({ success: true, sequence });
      }

      case 'enroll-lead': {
        if (!data.leadId || !data.sequenceId || !data.organizationId) {
          return errors.badRequest('leadId, sequenceId, and organizationId are required');
        }
        const result = await enrollLeadInSequence(data.leadId, data.sequenceId, data.organizationId);
        if (!result.success) {
          return errors.badRequest((result.error !== '' && result.error != null) ? result.error : 'Failed to enroll lead');
        }
        return NextResponse.json({ success: true });
      }

      case 'analyze-lifecycle': {
        if (!data.leadId) {
          return errors.badRequest('leadId is required');
        }
        const analysis = analyzeLeadLifecycle(data.leadId);
        return NextResponse.json({ success: true, analysis });
      }

      case 'get-attribution': {
        if (!data.leadId) {
          return errors.badRequest('leadId is required');
        }
        // Type assertion: validation ensures model is one of the valid values
        const attribution = getLeadAttribution(
          data.leadId,
          data.model as 'linear' | 'first_touch' | 'last_touch' | 'time_decay' | 'u_shaped'
        );
        return NextResponse.json({ success: true, attribution });
      }

      default:
        return errors.badRequest('Invalid action');
    }
  } catch (error: unknown) {
    logger.error('Lead nurture error', error instanceof Error ? error : new Error(String(error)), { route: '/api/leads/nurture' });
    return errors.database('Failed to process nurture request', error instanceof Error ? error : new Error(String(error)));
  }
}
