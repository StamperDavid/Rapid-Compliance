import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';

export async function GET(_req: NextRequest) {
  try {
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
  } catch (error) {
    logger.error('Error fetching platform sales agent persona', error, { 
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
    if (!adminDal) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const personaData = await req.json();

    // Save the persona to Firestore using nested doc reference
    const personaDocRef = adminDal.getNestedDocRef('admin/platform-sales-agent/config/persona');
    
    await personaDocRef.set({
      ...personaData,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'admin' // In production, use actual admin user ID
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error saving platform sales agent persona', error, { 
      route: '/api/admin/sales-agent/persona',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to save persona' },
      { status: 500 }
    );
  }
}

