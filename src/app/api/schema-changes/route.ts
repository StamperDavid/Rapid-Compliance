/**
 * Schema Changes API
 * Endpoints for managing schema change events and impact analysis
 */

import { type NextRequest, NextResponse } from 'next/server';
import { type QueryConstraint, where } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import {
  type SchemaChangeEvent,
  SchemaChangeEventPublisher
} from '@/lib/schema/schema-change-tracker';
import {
  processSchemaChangeEvent,
  processUnprocessedEvents,
} from '@/lib/schema/schema-change-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/schema-changes
 * Get schema change events
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const schemaId = searchParams.get('schemaId');
    const workspaceId = 'default';
    const unprocessedOnly = searchParams.get('unprocessedOnly') === 'true';

    // Get events
    let events: SchemaChangeEvent[];

    if (unprocessedOnly) {
      events = await SchemaChangeEventPublisher.getUnprocessedEvents(
        schemaId ?? undefined
      );
    } else {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const eventsPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/schemaChangeEvents`;

      const filters: QueryConstraint[] = [];
      if (schemaId) {
        filters.push(where('schemaId', '==', schemaId));
      }
      filters.push(where('workspaceId', '==', workspaceId));

      events = await FirestoreService.getAll<SchemaChangeEvent>(eventsPath, filters);
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
interface ProcessRequestBody {
  eventId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProcessRequestBody;
    const { eventId } = body;

    if (eventId) {
      // Process single event
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const eventsPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/schemaChangeEvents`;

      const event = await FirestoreService.get(eventsPath, eventId);

      if (!event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }

      await processSchemaChangeEvent(event as SchemaChangeEvent);

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



