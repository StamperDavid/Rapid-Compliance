import { NextRequest, NextResponse } from 'next/server';
import { processOnboarding } from '@/lib/agent/onboarding-processor';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { validateInput } from '@/lib/validation/schemas';
import { z } from 'zod';
import { OnboardingData } from '@/types/agent-memory';

const processOnboardingSchema = z.object({
  organizationId: z.string(),
  onboardingData: z.record(z.any()),
});

export async function POST(request: NextRequest) {
  try {
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
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
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
        console.log(`Creating new organization ${organizationId} for user ${user.uid}`);
      }
    } catch (error) {
      console.error('Error checking organization access:', error);
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
          console.warn('Failed to update user organizationId:', error);
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
    console.error('Error processing onboarding:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process onboarding' },
      { status: 500 }
    );
  }
}

