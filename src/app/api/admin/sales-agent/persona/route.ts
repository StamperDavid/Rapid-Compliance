import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

interface PersonaData {
  name?: string;
  description?: string;
  traits?: string[];
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireRole(req, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Get the platform sales agent persona from Firestore using nested doc reference
    const personaDocRef = adminDal.getNestedDocRef('admin/platform-sales-agent/config/persona');
    const personaDoc = await personaDocRef.get();

    if (!personaDoc.exists) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    return NextResponse.json(personaDoc.data());
  } catch (error: unknown) {
    logger.error('Error fetching platform sales agent persona', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/admin/sales-agent/persona',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch persona' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireRole(req, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const personaData = (await req.json()) as PersonaData;

    // Save the persona to Firestore using nested doc reference
    const personaDocRef = adminDal.getNestedDocRef('admin/platform-sales-agent/config/persona');

    await personaDocRef.set({
      ...personaData,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: authResult.user.uid,
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error saving platform sales agent persona', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/admin/sales-agent/persona',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to save persona' },
      { status: 500 }
    );
  }
}

