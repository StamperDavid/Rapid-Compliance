/**
 * Schema Update API
 * Handles schema updates with proper event publishing (server-side)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { SchemaChangeDetector } from '@/lib/schema/schema-change-tracker';
import { SchemaChangeEventPublisherServer } from '@/lib/schema/server/schema-change-publisher-server';
import { SchemaChangeDebouncer } from '@/lib/schema/schema-change-debouncer';

// Initialize admin if needed
if (!admin.apps.length) {
  try {
    const serviceAccount = require('@/../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    // Already initialized
  }
}

/**
 * POST /api/schemas/[schemaId]/update
 * Update schema and publish events (server-side)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { organizationId, workspaceId, updates, userId } = body;
    
    if (!organizationId || !workspaceId || !updates || !userId) {
      return NextResponse.json(
        { error: 'organizationId, workspaceId, updates, and userId are required' },
        { status: 400 }
      );
    }
    
    const db = getFirestore();
    
    // Get current schema
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
    
    const oldSchema = schemaDoc.data();
    
    // Create new schema with updates
    const newSchema = { ...oldSchema, ...updates };
    
    // Detect changes
    const events = SchemaChangeDetector.detectChanges(
      oldSchema as any,
      newSchema as any,
      organizationId
    );
    
    // Publish events via debouncer (server-side)
    if (events.length > 0) {
      const debouncer = SchemaChangeDebouncer.getInstance(5000);
      for (const event of events) {
        // Use server-side publisher
        await SchemaChangeEventPublisherServer.publishEvent(event);
      }
    }
    
    // Update schema
    await schemaDoc.ref.update({
      ...updates,
      version: (oldSchema?.version || 1) + 1,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: userId,
    });
    
    return NextResponse.json({
      success: true,
      eventsPublished: events.length,
      message: 'Schema updated successfully',
    });
    
  } catch (error: any) {
    console.error('[Schema Update API] Error:', error);
    
    return NextResponse.json(
      { error: 'Failed to update schema', details: error.message },
      { status: 500 }
    );
  }
}


