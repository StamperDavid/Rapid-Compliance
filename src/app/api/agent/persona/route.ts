import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';
import { getSubCollection } from '@/lib/firebase/collections';

const PersonaDataSchema = z.object({
  name: z.string().optional(),
  tagline: z.string().optional(),
  personalityArchetype: z.string().optional(),
  toneOfVoice: z.string().optional(),
  responseStyle: z.string().optional(),
  proactivityLevel: z.string().optional(),
  empathyLevel: z.string().optional(),
  version: z.number().optional(),
}).passthrough();

export async function GET(
  req: NextRequest
) {
  try {
    const authResult = await requireRole(req, ['owner', 'admin', 'manager']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Try to load existing persona using nested doc reference
    const personaDocRef = adminDal.getNestedDocRef(
      `${getSubCollection('ai-agents')}/default/config/persona`
    );
    const personaDoc = await personaDocRef.get();

    if (personaDoc.exists) {
      return NextResponse.json({ persona: personaDoc.data() });
    }

    // If no persona exists, check if onboarding data exists to auto-generate
    const onboardingDocRef = adminDal.getNestedDocRef(
      `${getSubCollection('onboarding')}/data`
    );
    const onboardingDoc = await onboardingDocRef.get();

    if (onboardingDoc.exists) {
      return NextResponse.json({ onboarding: onboardingDoc.data() });
    }

    // Return empty if neither exists
    return NextResponse.json({ persona: null, onboarding: null });
  } catch (error: unknown) {
    logger.error('Error fetching persona', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/agent/persona',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch persona' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest
) {
  try {
    const authResult = await requireRole(req, ['owner', 'admin', 'manager']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const rawData: unknown = await req.json();
    const parseResult = PersonaDataSchema.safeParse(rawData);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid persona data' }, { status: 400 });
    }

    const personaData = parseResult.data;

    // Save persona to Firestore using nested doc reference
    const personaDocRef = adminDal.getNestedDocRef(
      `${getSubCollection('ai-agents')}/default/config/persona`
    );

    const currentVersion = personaData.version ?? 0;

    await personaDocRef.set({
      ...personaData,
      updatedAt: FieldValue.serverTimestamp(),
      version: currentVersion + 1
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error saving persona', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/agent/persona',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to save persona' },
      { status: 500 }
    );
  }
}
