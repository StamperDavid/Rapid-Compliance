import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const { orgId } = params;

    // Try to load existing persona
    const personaDoc = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('ai-agents')
      .doc('default')
      .collection('config')
      .doc('persona')
      .get();

    if (personaDoc.exists) {
      return NextResponse.json({ persona: personaDoc.data() });
    }

    // If no persona exists, check if onboarding data exists to auto-generate
    const onboardingDoc = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('onboarding')
      .doc('data')
      .get();

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
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const { orgId } = params;
    const personaData = await req.json();

    // Save persona to Firestore
    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('ai-agents')
      .doc('default')
      .collection('config')
      .doc('persona')
      .set({
        ...personaData,
        updatedAt: new Date().toISOString(),
        version: (personaData.version || 0) + 1
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

