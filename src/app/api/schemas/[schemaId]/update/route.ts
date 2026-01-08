/**
 * Schema Update API
 * Handles schema updates with proper event publishing (server-side)
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { SchemaChangeDetector } from '@/lib/schema/schema-change-tracker';
import { SchemaChangeEventPublisherServer } from '@/lib/schema/server/schema-change-publisher-server';
import { SchemaChangeDebouncer } from '@/lib/schema/schema-change-debouncer';
import { logger } from '@/lib/logger/logger';

/**
 * POST /api/schemas/[schemaId]/update
 * Update schema and publish events (server-side)
 */
export async function POST(
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
    const body = await request.json();
    const { organizationId, workspaceId, updates, userId } = body;
    
    if (!organizationId || !workspaceId || !updates || !userId) {
      return NextResponse.json(
        { error: 'organizationId, workspaceId, updates, and userId are required' },
        { status: 400 }
      );
    }
    
    // Get current schema using Admin DAL
    const schemasCollection = adminDal.getWorkspaceCollection(organizationId, workspaceId, 'schemas');
    const schemaDoc = await schemasCollection.doc(params.schemaId).get();
    
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
      newSchema,
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
    
    // Update schema using Admin DAL
    await schemaDoc.ref.update({
      ...updates,
      version: (oldSchema?.version ?? 1) + 1,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    });
    
    return NextResponse.json({
      success: true,
      eventsPublished: events.length,
      message: 'Schema updated successfully',
    });
    
  } catch (error: any) {
    logger.error('Failed to update schema', error, {
      route: '/api/schemas/[schemaId]/update',
      method: 'POST'
    });
    
    return NextResponse.json(
      { error: 'Failed to update schema', details: error.message },
      { status: 500 }
    );
  }
}


