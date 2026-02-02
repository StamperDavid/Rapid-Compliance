/**
 * Schema CRUD API - get/delete single schema (server-side, admin SDK)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const params = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const schemasCollection = adminDal.getOrgCollection(organizationId, 'schemas');
    const docSnap = await schemasCollection.doc(params.schemaId).get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, schema: { id: docSnap.id, ...docSnap.data() } });
  } catch (error: unknown) {
    logger.error('Failed to fetch schema', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/schemas/[schemaId]',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch schema', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const params = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const schemasCollection = adminDal.getOrgCollection(organizationId, 'schemas');
    const docRef = schemasCollection.doc(params.schemaId);

    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    await docRef.update({
      status: 'archived',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to delete schema', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/schemas/[schemaId]',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to delete schema', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


