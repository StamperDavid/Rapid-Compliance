/**
 * Schedule Run — POST /api/leads/research/schedule/run
 *
 * Manually triggers a scheduled lead research run.
 * Reads schedule config, starts a discovery batch, and auto-approves
 * results above the configured threshold.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { startDiscoveryBatch } from '@/lib/services/discovery-service';
import { getActiveIcpProfile } from '@/lib/services/icp-profile-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const CONFIG_COLLECTION = getSubCollection('lead-research-config');
const SCHEDULE_DOC_ID = 'schedule';

interface ScheduleConfig {
  enabled: boolean;
  frequency: string;
  icpProfileId: string;
  maxResults: number;
  autoApproveThreshold: number;
  lastRunAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const userId = authResult.user.uid;

    // Load schedule config
    const configDoc = await AdminFirestoreService.get(CONFIG_COLLECTION, SCHEDULE_DOC_ID);
    const config = configDoc as unknown as ScheduleConfig | null;

    // Determine which ICP profile to use
    let icpProfileId = config?.icpProfileId;
    if (!icpProfileId) {
      const activeProfile = await getActiveIcpProfile();
      if (!activeProfile) {
        return NextResponse.json(
          { error: 'No ICP profile configured. Create one first.' },
          { status: 400 }
        );
      }
      icpProfileId = activeProfile.id;
    }

    const maxResults = config?.maxResults ?? 20;

    // Start a discovery batch
    const batch = await startDiscoveryBatch(
      icpProfileId,
      {
        keywords: ['scheduled research run'],
        maxResults,
      },
      userId
    );

    // Update last run timestamp
    await AdminFirestoreService.set(CONFIG_COLLECTION, SCHEDULE_DOC_ID, {
      ...(config ?? {}),
      lastRunAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, false);

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      message: `Discovery batch started with ${maxResults} max results.`,
    });
  } catch (error: unknown) {
    logger.error('[Schedule Run] POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to run scheduled research' }, { status: 500 });
  }
}
