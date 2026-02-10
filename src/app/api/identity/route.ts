import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface OrgData {
  brandDNA?: BrandDNA;
  [key: string]: unknown;
}

interface BrandDNA {
  toneOfVoice?: string;
  [key: string]: unknown;
}

const IdentitySchema = z.object({
  workforceName: z.string().min(1, 'Workforce name is required'),
  tagline: z.string().optional(),
  personalityArchetype: z.string().optional(),
  responseStyle: z.string().optional(),
  proactivityLevel: z.string().optional(),
  empathyLevel: z.string().optional(),
  avatarStyle: z.string().optional(),
  primaryColor: z.string().optional(),
  voiceEngine: z.string().optional(),
  voiceId: z.string().optional(),
  voiceName: z.string().optional(),
}).passthrough();

const SaveIdentityBodySchema = z.object({
  identity: IdentitySchema,
  brandDNA: z.object({
    toneOfVoice: z.string().optional(),
  }).passthrough().optional(),
  userId: z.string().optional(),
});

/**
 * GET /api/identity
 * Load the workforce identity configuration for SalesVelocity.ai
 */
export async function GET(
  _req: NextRequest
) {
  try {
    const authResult = await requireAuth(_req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal || !adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Load workforce identity
    const identityDocRef = adminDb.collection('organizations').doc(PLATFORM_ID)
      .collection('settings').doc('workforceIdentity');
    const identityDoc = await identityDocRef.get();

    // Load brand DNA from organization
    const orgDocRef = adminDb.collection('organizations').doc(PLATFORM_ID);
    const orgDoc = await orgDocRef.get();
    const orgData = orgDoc.exists ? (orgDoc.data() as OrgData | undefined) : null;

    // Load onboarding data for pre-population if needed
    const onboardingDocRef = adminDb.collection('organizations').doc(PLATFORM_ID)
      .collection('onboarding').doc('current');
    const onboardingDoc = await onboardingDocRef.get();
    const onboardingData = onboardingDoc.exists ? onboardingDoc.data() : null;

    if (identityDoc.exists) {
      return NextResponse.json({
        success: true,
        identity: identityDoc.data(),
        brandDNA: orgData?.brandDNA ?? null,
        onboardingData,
      });
    }

    // Return null identity with org/onboarding data for pre-population
    return NextResponse.json({
      success: true,
      identity: null,
      brandDNA: orgData?.brandDNA ?? null,
      onboardingData,
    });

  } catch (error: unknown) {
    logger.error('Error fetching identity', error instanceof Error ? error : undefined, {
      route: '/api/identity',
      method: 'GET'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch identity' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/identity
 * Save the workforce identity configuration for SalesVelocity.ai
 */
export async function POST(
  req: NextRequest
) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const rawBody: unknown = await req.json();
    const parseResult = SaveIdentityBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.errors[0]?.message ?? 'Invalid identity data' },
        { status: 400 }
      );
    }

    const { identity, brandDNA, userId } = parseResult.data;
    const userIdValue = userId ?? 'unknown';

    // Start a batch write for atomic updates
    const batch = adminDb.batch();

    // Save workforce identity
    const identityDocRef = adminDb.collection('organizations').doc(PLATFORM_ID)
      .collection('settings').doc('workforceIdentity');

    batch.set(identityDocRef, {
      ...identity,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userIdValue,
      status: 'active',
    }, { merge: true });

    // Update organization Brand DNA if provided
    if (brandDNA) {
      const orgDocRef = adminDb.collection('organizations').doc(PLATFORM_ID);
      batch.update(orgDocRef, {
        brandDNA: {
          ...brandDNA,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userIdValue,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Mark identity refinement as complete
    const progressDocRef = adminDb.collection('organizations').doc(PLATFORM_ID)
      .collection('settings').doc('onboardingProgress');

    batch.set(progressDocRef, {
      identityRefinementCompleted: true,
      identityCompletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Also update the agent persona with the new identity
    const personaDocRef = adminDb.collection('organizations').doc(PLATFORM_ID)
      .collection('agentPersona').doc('current');

    batch.set(personaDocRef, {
      name: identity.workforceName,
      tagline: identity.tagline,
      personalityArchetype: identity.personalityArchetype,
      toneOfVoice: brandDNA?.toneOfVoice ?? 'professional',
      responseStyle: identity.responseStyle,
      proactivityLevel: identity.proactivityLevel,
      empathyLevel: identity.empathyLevel,
      avatarStyle: identity.avatarStyle,
      primaryColor: identity.primaryColor,
      voiceEngine: identity.voiceEngine,
      voiceId: identity.voiceId,
      voiceName: identity.voiceName,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userIdValue,
    }, { merge: true });

    // Commit all changes
    await batch.commit();

    logger.info('Identity saved successfully', {
      workforceName: identity.workforceName,
      route: '/api/identity'
    });

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    logger.error('Error saving identity', error instanceof Error ? error : undefined, {
      route: '/api/identity',
      method: 'POST'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to save identity' },
      { status: 500 }
    );
  }
}
