import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { processOnboarding } from '@/lib/agent/onboarding-processor';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { validateInput } from '@/lib/validation/schemas';
import { z } from 'zod';
import type { OnboardingData } from '@/types/agent-memory';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Schema for onboarding request validation
const processOnboardingSchema = z.object({
  organizationId: z.string(),
  onboardingData: z.record(z.any()),
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
    const body = await request.json();
    const validation = validateInput(processOnboardingSchema, body);

    if (!validation.success) {
      // Type assertion: when success is false, we have the error structure
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => {
        const joinedPath = e.path?.join('.');
        return {
          path: (joinedPath !== '' && joinedPath != null) ? joinedPath : 'unknown',
          message: (e.message !== '' && e.message != null) ? e.message : 'Validation error',
        };
      }) ?? [];
      
      return errors.validation('Validation failed', errorDetails);
    }

    const { organizationId, onboardingData } = validation.data;

    // Import Admin SDK services for multi-tenant security check
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const { COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    try {
      const org = await AdminFirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);
      
      if (org) {
        // Organization exists - verify user is owner or member
        const isOwner = org.ownerId === user.uid;
        const isMember = org.members?.includes(user.uid);
        const isAdmin = user.role === 'admin' || user.role === 'super_admin';
        
        if (!isOwner && !isMember && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'You do not have permission to configure this organization' },
            { status: 403 }
          );
        }
      } else {
        // Organization doesn't exist yet - user is creating it during onboarding
        // This is allowed, but we'll set them as the owner
        logger.debug('Creating new organization during onboarding', { organizationId, userId: user.uid, route: '/api/agent/process-onboarding' });
      }
    } catch (error) {
      logger.error('Error checking organization access', error, { route: '/api/agent/process-onboarding' });
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
    
    // Process onboarding
    const result = await processOnboarding({
      onboardingData: onboardingData as OnboardingData,
      organizationId,
      userId: user.uid,
    });

    if (result.success) {
      // Update user's organizationId if not already set
      if (!user.organizationId) {
        try {
          await AdminFirestoreService.update('users', user.uid, {
            organizationId,
            currentOrganizationId: organizationId,
            updatedAt: new Date().toISOString(),
          });
        } catch (error) {
          logger.warn('Failed to update user organizationId', { route: '/api/agent/process-onboarding', error });
          // Continue anyway - onboarding succeeded
        }
      }
      
      return NextResponse.json({
        success: true,
        persona: result.persona,
        knowledgeBase: result.knowledgeBase,
        baseModel: result.baseModel, // Returns editable Base Model, not Golden Master
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error('Onboarding processing error', error, { route: '/api/agent/process-onboarding' });
    return errors.internal('Failed to process onboarding', error);
  }
}

