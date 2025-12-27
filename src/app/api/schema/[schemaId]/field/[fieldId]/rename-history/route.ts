/**
 * Field Rename History API
 * Get rename history and rollback fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { FieldRenameManager } from '@/lib/schema/field-rename-manager';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('@/../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * GET /api/schema/[schemaId]/field/[fieldId]/rename-history
 * Get rename history for a field
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string; fieldId: string }> }
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
    
    // Use admin SDK
    const db = getFirestore();
    
    // Get schema
    const schemaDoc = await db
      .collection('organizations')
      .doc(organizationId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('schemas')
      .doc(params.schemaId)
      .get();
    
    if (!schemaDoc.exists) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      );
    }
    
    const schema = schemaDoc.data();
    
    // Find field
    const field = schema?.fields?.find((f: any) => f.id === params.fieldId);
    
    if (!field) {
      return NextResponse.json(
        { error: 'Field not found' },
        { status: 404 }
      );
    }
    
    // Get rename history
    const history = FieldRenameManager.getRenameHistory(field);
    const timeline = FieldRenameManager.getRenameTimeline(field);
    const aliases = FieldRenameManager.getAllAliases(field);
    
    return NextResponse.json({
      success: true,
      field: {
        id: field.id,
        currentKey: field.key,
        currentLabel: field.label,
      },
      history,
      timeline,
      aliases,
    });
    
  } catch (error) {
    logger.error('[Rename History API] GET failed', error, {
      file: 'route.ts',
    });
    
    return NextResponse.json(
      { error: 'Failed to get rename history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schema/[schemaId]/field/[fieldId]/rename-history
 * Rollback field to previous name
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string; fieldId: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { organizationId, workspaceId, toVersion, userId } = body;
    
    if (!organizationId || !workspaceId || toVersion === undefined || !userId) {
      return NextResponse.json(
        { error: 'organizationId, workspaceId, toVersion, and userId are required' },
        { status: 400 }
      );
    }
    
    // Rollback field
    await FieldRenameManager.rollbackField(
      organizationId,
      workspaceId,
      params.schemaId,
      params.fieldId,
      toVersion,
      userId
    );
    
    return NextResponse.json({
      success: true,
      message: `Field rolled back to version ${toVersion}`,
    });
    
  } catch (error) {
    logger.error('[Rename History API] POST failed', error, {
      file: 'route.ts',
    });
    
    return NextResponse.json(
      { error: 'Failed to rollback field' },
      { status: 500 }
    );
  }
}

