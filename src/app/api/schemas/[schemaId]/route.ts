/**
 * Schema CRUD API - get/delete single schema (server-side, admin SDK)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string }> }
) {
  try {
    const params = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId');

    if (!organizationId || !workspaceId) {
      return NextResponse.json(
        { error: 'organizationId and workspaceId are required' },
        { status: 400 }
      );
    }

    const docRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('schemas')
      .doc(params.schemaId);

    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, schema: { id: docSnap.id, ...docSnap.data() } });
  } catch (error: any) {
    logger.error('Failed to fetch schema', error, {
      route: '/api/schemas/[schemaId]',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch schema', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string }> }
) {
  try {
    const params = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId');

    if (!organizationId || !workspaceId) {
      return NextResponse.json(
        { error: 'organizationId and workspaceId are required' },
        { status: 400 }
      );
    }

    const now = admin.firestore.Timestamp.now();

    const docRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('schemas')
      .doc(params.schemaId);

    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    await docRef.update({
      status: 'archived',
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete schema', error, {
      route: '/api/schemas/[schemaId]',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to delete schema', details: error.message },
      { status: 500 }
    );
  }
}


