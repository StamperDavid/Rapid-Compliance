import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const { orgId } = params;

    // Try to load existing persona using nested doc reference
    const personaDocRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/ai-agents/default/config/persona',
      { orgId }
    );
    const personaDoc = await personaDocRef.get();

    if (personaDoc.exists) {
      return NextResponse.json({ persona: personaDoc.data() });
    }

    // If no persona exists, check if onboarding data exists to auto-generate
    const onboardingDocRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/onboarding/data',
      { orgId }
    );
    const onboardingDoc = await onboardingDocRef.get();

    if (onboardingDoc.exists) {
      return NextResponse.json({ onboarding: onboardingDoc.data() });
    }

    // Return empty if neither exists
    return NextResponse.json({ persona: null, onboarding: null });
  } catch (error) {
    logger.error('Error fetching persona', error, { 
      route: '/api/workspace/[orgId]/agent/persona',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch persona' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const { orgId } = params;
    const personaData = await req.json();

    // Save persona to Firestore using nested doc reference
    const personaDocRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/ai-agents/default/config/persona',
      { orgId }
    );
    
    await personaDocRef.set({
      ...personaData,
      updatedAt: FieldValue.serverTimestamp(),
      version: (personaData.version ?? 0) + 1
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error saving persona', error, { 
      route: '/api/workspace/[orgId]/agent/persona',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to save persona' },
      { status: 500 }
    );
  }
}

