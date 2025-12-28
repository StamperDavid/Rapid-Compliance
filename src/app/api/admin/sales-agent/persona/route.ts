import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Get the platform sales agent persona from Firestore
    const personaDoc = await adminDb
      .collection('admin')
      .doc('platform-sales-agent')
      .collection('config')
      .doc('persona')
      .get();

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
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const personaData = await req.json();

    // Save the persona to Firestore
    await adminDb
      .collection('admin')
      .doc('platform-sales-agent')
      .collection('config')
      .doc('persona')
      .set({
        ...personaData,
        updatedAt: new Date().toISOString(),
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

