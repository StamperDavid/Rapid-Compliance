/**
 * Schema Update API
 * Handles schema updates with proper event publishing (server-side)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { SchemaChangeDetector } from '@/lib/schema/schema-change-tracker';
import { SchemaChangeEventPublisherServer } from '@/lib/schema/server/schema-change-publisher-server';
import { logger } from '@/lib/logger/logger';
import type { Schema } from '@/types/schema';

export const dynamic = 'force-dynamic';

const PostSchemaUpdateSchema = z.object({
  updates: z.record(z.unknown()),
  userId: z.string().min(1),
});

/**
 * POST /api/schemas/[schemaId]/update
 * Update schema and publish events (server-side)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const params = await context.params;
    const rawBody: unknown = await request.json();
    const parsed = PostSchemaUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { updates, userId } = parsed.data;

    // Get current schema using Admin DAL
    const schemasCollection = adminDal.getPlatformCollection('schemas');
    const schemaDoc = await schemasCollection.doc(params.schemaId).get();

    if (!schemaDoc.exists) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      );
    }

    const oldSchemaData = schemaDoc.data() as Schema | undefined;

    if (!oldSchemaData) {
      return NextResponse.json(
        { error: 'Schema data not found' },
        { status: 404 }
      );
    }

    // Create new schema with updates
    const newSchema: Schema = { ...oldSchemaData, ...updates } as Schema;

    // Detect changes
    const events = SchemaChangeDetector.detectChanges(
      oldSchemaData,
      newSchema
    );

    // Publish events (server-side)
    if (events.length > 0) {
      for (const event of events) {
        await SchemaChangeEventPublisherServer.publishEvent(event);
      }
    }

    // Update schema using Admin DAL
    const version = typeof oldSchemaData.version === 'number' ? oldSchemaData.version : 1;
    await schemaDoc.ref.update({
      ...updates,
      version: version + 1,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    });
    
    return NextResponse.json({
      success: true,
      eventsPublished: events.length,
      message: 'Schema updated successfully',
    });
    
  } catch (error: unknown) {
    logger.error('Failed to update schema', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/schemas/[schemaId]/update',
      method: 'POST'
    });

    return NextResponse.json(
      { error: 'Failed to update schema', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


