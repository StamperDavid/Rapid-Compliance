import { NextRequest, NextResponse } from 'next/server';
import { processOnboarding } from '@/lib/agent/onboarding-processor';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { validateInput } from '@/lib/validation/schemas';
import { z } from 'zod';

const processOnboardingSchema = z.object({
  organizationId: z.string(),
  onboardingData: z.record(z.any()),
});

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(processOnboardingSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { organizationId, onboardingData } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Process onboarding
    const result = await processOnboarding({
      onboardingData,
      organizationId,
      userId: user.uid,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        persona: result.persona,
        knowledgeBase: result.knowledgeBase,
        goldenMaster: result.goldenMaster,
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

