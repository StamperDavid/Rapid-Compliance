import { type NextRequest, NextResponse } from 'next/server';
import { processOnboarding } from '@/lib/agent/onboarding-processor';
import { requireAuth } from '@/lib/auth/api-auth';
import { validateInput } from '@/lib/validation/schemas';
import { z } from 'zod';
import type { OnboardingData } from '@/types/agent-memory';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Interfaces for type safety
interface ValidationErrorDetail {
  path: string;
  message: string;
}

interface ZodValidationError {
  path: Array<string | number>;
  message: string;
}

interface ValidationFailureResult {
  success: false;
  errors: {
    errors?: ZodValidationError[];
  };
}

interface OrganizationRecord {
  ownerId: string;
  members?: string[];
  [key: string]: unknown;
}

interface OrganizationUpdateData {
  updatedAt: string;
  industry: string;
  industryName: string;
  assistantName?: string;
  ownerName?: string;
}

// Result type for API responses
interface ApiSuccessResponse {
  success: true;
  persona: unknown;
  knowledgeBase: unknown;
  baseModel: unknown;
}

interface ApiErrorResponse {
  success: false;
  error: string;
}

// Union type for all API responses (used for type annotations)
type _ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// Schema for onboarding request validation
const processOnboardingSchema = z.object({
  organizationId: z.string(),
  onboardingData: z.record(z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/process-onboarding');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication - just require auth, not organization membership
    // (user is setting up their organization via onboarding)
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = validateInput(processOnboardingSchema, body);

    if (!validation.success) {
      // Type-safe validation error handling
      const validationError = validation as ValidationFailureResult;
      const zodErrors = validationError.errors?.errors;

      const errorDetails: ValidationErrorDetail[] = Array.isArray(zodErrors)
        ? zodErrors.map((e: ZodValidationError): ValidationErrorDetail => {
            const joinedPath = Array.isArray(e.path) ? e.path.join('.') : '';
            return {
              path: (joinedPath !== '' && joinedPath !== null) ? joinedPath : 'unknown',
              message: (e.message !== '' && e.message !== null) ? e.message : 'Validation error',
            };
          })
        : [];

      return errors.validation('Validation failed', errorDetails);
    }

    const { organizationId, onboardingData } = validation.data;

    // Import Admin SDK services for multi-tenant security check
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const { COLLECTIONS } = await import('@/lib/db/firestore-service');

    try {
      const orgData: unknown = await AdminFirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);

      if (orgData && typeof orgData === 'object') {
        const org = orgData as OrganizationRecord;

        // Organization exists - verify user is owner or member
        const isOwner = org.ownerId === user.uid;
        const isMember = Array.isArray(org.members) && org.members.includes(user.uid);
        const userRole = user.role ?? '';
        const isAdmin = userRole === 'admin' || userRole === 'super_admin';

        if (!isOwner && !isMember && !isAdmin) {
          return NextResponse.json<ApiErrorResponse>(
            { success: false, error: 'You do not have permission to configure this organization' },
            { status: 403 }
          );
        }
      } else {
        // Organization doesn't exist yet - user is creating it during onboarding
        // This is allowed, but we'll set them as the owner
        logger.debug('Creating new organization during onboarding', { organizationId, userId: user.uid, route: '/api/agent/process-onboarding' });
      }
    } catch (error: unknown) {
      logger.error('Error checking organization access', error instanceof Error ? error : undefined, { route: '/api/agent/process-onboarding' });
      // If we can't verify, allow it (onboarding scenario)
    }

    // Save onboarding data first (using Admin SDK)
    await AdminFirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/onboarding`,
      'current',
      {
        ...onboardingData,
        completedAt: new Date().toISOString(),
        organizationId,
      },
      false
    );

    // Type guard to check if onboardingData has required properties
    const typedOnboardingData = onboardingData as Partial<OnboardingData>;
    const industry = typeof typedOnboardingData.industry === 'string' ? typedOnboardingData.industry : 'unknown';

    // Update organization with assistant name and owner name
    const orgUpdate: OrganizationUpdateData = {
      updatedAt: new Date().toISOString(),
      industry: industry,
      industryName: industry, // Industry display name
    };

    // Save assistant name if provided
    if (
      'agentName' in typedOnboardingData &&
      typeof typedOnboardingData.agentName === 'string' &&
      typedOnboardingData.agentName !== ''
    ) {
      orgUpdate.assistantName = typedOnboardingData.agentName;
    }

    // Save owner name if provided
    if (
      'ownerName' in typedOnboardingData &&
      typeof typedOnboardingData.ownerName === 'string' &&
      typedOnboardingData.ownerName !== ''
    ) {
      orgUpdate.ownerName = typedOnboardingData.ownerName;
    }

    await AdminFirestoreService.update(COLLECTIONS.ORGANIZATIONS, organizationId, orgUpdate as unknown as Record<string, unknown>);

    // Process onboarding
    const result = await processOnboarding({
      onboardingData: onboardingData as unknown as OnboardingData,
      organizationId,
      userId: user.uid,
    });

    if (result.success) {
      // Update user's organizationId if not already set
      const userOrgId = user.organizationId;
      if (typeof userOrgId !== 'string' || userOrgId === '') {
        try {
          await AdminFirestoreService.update('users', user.uid, {
            organizationId,
            currentOrganizationId: organizationId,
            updatedAt: new Date().toISOString(),
          });
        } catch (error: unknown) {
          logger.warn('Failed to update user organizationId', { route: '/api/agent/process-onboarding', error: error instanceof Error ? error.message : String(error) });
          // Continue anyway - onboarding succeeded
        }
      }

      return NextResponse.json<ApiSuccessResponse>({
        success: true,
        persona: result.persona ?? null,
        knowledgeBase: result.knowledgeBase ?? null,
        baseModel: result.baseModel ?? null, // Returns editable Base Model, not Golden Master
      });
    } else {
      const errorMessage = typeof result.error === 'string' ? result.error : 'Unknown error occurred during onboarding';
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    logger.error('Onboarding processing error', error instanceof Error ? error : undefined, { route: '/api/agent/process-onboarding' });
    return errors.internal('Failed to process onboarding', error instanceof Error ? error : undefined);
  }
}

