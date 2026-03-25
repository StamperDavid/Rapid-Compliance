/**
 * Workflow Entity Poll Cron Endpoint
 * Polls for recent entity changes in Firestore and fires matching workflow triggers.
 * Should be called every 1-5 minutes by a cron job (Vercel Cron or external service).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleEntityChange } from '@/lib/workflows/triggers/firestore-trigger';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/workflow-entity-poll
 * Check for recent entity changes and fire matching triggers
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error('CRON_SECRET not configured - rejecting request', new Error('Missing CRON_SECRET'), {
        route: '/api/cron/workflow-entity-poll',
      });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      logger.error('Unauthorized cron access attempt', new Error('Invalid cron secret'), {
        route: '/api/cron/workflow-entity-poll',
        method: 'GET',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting entity poll cron', {
      route: '/api/cron/workflow-entity-poll',
    });

    // Get all registered entity triggers to know which collections to watch
    const { where } = await import('firebase/firestore');
    const triggers = await FirestoreService.getAll(
      getSubCollection('workflowTriggers'),
      [where('triggerType', '>=', 'entity.'), where('triggerType', '<=', 'entity.\uf8ff')]
    );

    if (triggers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No entity triggers registered',
        triggersProcessed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Determine the polling window (last 5 minutes)
    const pollWindowMs = 5 * 60 * 1000;
    const since = new Date(Date.now() - pollWindowMs).toISOString();

    // Get unique schema IDs to poll
    const schemaIds = [...new Set(
      triggers
        .filter((t): t is Record<string, unknown> & { schemaId: string } =>
          typeof t === 'object' && t !== null && 'schemaId' in t && typeof t.schemaId === 'string'
        )
        .map(t => t.schemaId)
    )];

    let entitiesProcessed = 0;

    // For each schema, check for recent changes
    for (const schemaId of schemaIds) {
      try {
        const { orderBy, limit: fbLimit } = await import('firebase/firestore');
        const recentRecords = await FirestoreService.getAll(
          getSubCollection(schemaId),
          [
            where('updatedAt', '>=', since),
            orderBy('updatedAt', 'desc'),
            fbLimit(50),
          ]
        );

        for (const record of recentRecords) {
          if (!record || typeof record !== 'object') { continue; }

          const recordData = record as Record<string, unknown>;
          const recordId = typeof recordData.id === 'string' ? recordData.id : '';

          if (!recordId) { continue; }

          // Determine change type based on timestamps
          const createdAt = String(recordData.createdAt ?? '');

          // If createdAt is within the poll window, it's a "created" event
          // Otherwise it's an "updated" event
          const changeType: 'created' | 'updated' =
            createdAt >= since ? 'created' : 'updated';

          await handleEntityChange(schemaId, changeType, recordId, recordData, 0);
          entitiesProcessed++;
        }
      } catch (error) {
        logger.warn(`[Entity Poll] Error polling schema ${schemaId}`, {
          route: '/api/cron/workflow-entity-poll',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Entity poll cron completed', {
      route: '/api/cron/workflow-entity-poll',
      entitiesProcessed,
      schemasPolled: schemaIds.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Entity poll completed',
      entitiesProcessed,
      schemasPolled: schemaIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      'Entity poll cron failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/cron/workflow-entity-poll' },
    );
    return NextResponse.json(
      { error: 'Entity poll failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
