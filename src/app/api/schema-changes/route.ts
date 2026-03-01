/**
 * Schema Changes API
 * Endpoints for managing schema change events and impact analysis
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  type SchemaChangeEvent,
  SchemaChangeEventPublisher
} from '@/lib/schema/schema-change-tracker';
import {
  processSchemaChangeEvent,
  processUnprocessedEvents,
} from '@/lib/schema/schema-change-handler';

const PostSchemaChangesSchema = z.object({
  eventId: z.string().optional(),
});

export const dynamic = 'force-dynamic';

/**
 * GET /api/schema-changes
 * Get schema change events
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const searchParams = request.nextUrl.searchParams;
    const schemaId = searchParams.get('schemaId');
    const unprocessedOnly = searchParams.get('unprocessedOnly') === 'true';

    // Get events
    let events: SchemaChangeEvent[];

    if (unprocessedOnly) {
      events = await SchemaChangeEventPublisher.getUnprocessedEvents(
        schemaId ?? undefined
      );
    } else {
      if (!adminDb) {
        return NextResponse.json(
          { error: 'Database not configured' },
          { status: 500 }
        );
      }

      const eventsPath = getSubCollection('schemaChangeEvents');
      let queryRef: FirebaseFirestore.Query = adminDb.collection(eventsPath);

      if (schemaId) {
        queryRef = queryRef.where('schemaId', '==', schemaId);
      }

      const snapshot = await queryRef.get();
      events = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SchemaChangeEvent[];
    }

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    });

  } catch (error: unknown) {
    logger.error('[Schema Changes API] GET failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'route.ts',
    });

    return NextResponse.json(
      { error: 'Failed to get schema changes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schema-changes/process
 * Manually process schema change events
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const parsed = PostSchemaChangesSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { eventId } = parsed.data;

    if (eventId) {
      // Process single event
      if (!adminDb) {
        return NextResponse.json(
          { error: 'Database not configured' },
          { status: 500 }
        );
      }

      const eventsPath = getSubCollection('schemaChangeEvents');
      const docSnap = await adminDb.collection(eventsPath).doc(eventId).get();

      if (!docSnap.exists) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }

      const event = { id: docSnap.id, ...docSnap.data() } as SchemaChangeEvent;

      await processSchemaChangeEvent(event);

      return NextResponse.json({
        success: true,
        message: 'Event processed successfully',
      });
    } else {
      // Process all unprocessed events
      const result = await processUnprocessedEvents();

      return NextResponse.json({
        success: true,
        message: 'Unprocessed events processed',
        processed: result.processed,
        failed: result.failed,
      });
    }

  } catch (error: unknown) {
    logger.error('[Schema Changes API] POST failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'route.ts',
    });

    return NextResponse.json(
      { error: 'Failed to process schema changes' },
      { status: 500 }
    );
  }
}
