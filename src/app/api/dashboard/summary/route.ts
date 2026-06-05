import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { where, orderBy, limit } from 'firebase/firestore';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface FirestoreTimestampLike {
  seconds: number;
  nanoseconds: number;
}

interface DealRecord {
  id: string;
  stage?: string;
  status?: string;
  value?: number;
  amount?: number;
  name?: string;
  createdAt?: FirestoreTimestampLike;
  [key: string]: unknown;
}

interface LeadRecord {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  createdAt?: FirestoreTimestampLike;
  [key: string]: unknown;
}

interface ConversationRecord {
  id: string;
  status?: string;
  outcome?: string;
  createdAt?: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
  [key: string]: unknown;
}

interface TaskRecord {
  id: string;
  title?: string;
  name?: string;
  priority?: string;
  status?: string;
  dueDate?: FirestoreTimestampLike;
  completed?: boolean;
  [key: string]: unknown;
}

/**
 * GET /api/dashboard/summary
 *
 * Runs every read the dashboard page used to do client-side, server-side via
 * the Admin SDK, and returns the raw document arrays. The page keeps its
 * existing derivation logic (pipeline stages, activity feed, conversation
 * stats) so behavior is identical — this route only moves the reads.
 *
 * Queries replicated:
 *  - leads:        records where entityType == 'leads'
 *  - deals:        records where entityType == 'deals'
 *  - conversations: conversations (limit 200)
 *  - tasks:        teamTasks where status in ['todo','in_progress','blocked'] (limit 5)
 *  - recentDeals:  records where entityType == 'deals' orderBy createdAt desc (limit 3)
 *  - recentLeads:  records where entityType == 'leads' orderBy createdAt desc (limit 3)
 *
 * Each sub-read that can throw on a missing collection/index is best-effort,
 * matching the page's original per-query try/catch behavior.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const recordsPath = getSubCollection('records');

    const leads = await AdminFirestoreService.getAll<LeadRecord>(
      recordsPath,
      [where('entityType', '==', 'leads')]
    );

    const deals = await AdminFirestoreService.getAll<DealRecord>(
      recordsPath,
      [where('entityType', '==', 'deals')]
    );

    const conversations = await AdminFirestoreService.getAll<ConversationRecord>(
      getSubCollection('conversations'),
      [limit(200)]
    );

    // Tasks — best-effort (collection/index may not exist yet).
    let tasks: TaskRecord[] = [];
    try {
      tasks = await AdminFirestoreService.getAll<TaskRecord>(
        getSubCollection('teamTasks'),
        [where('status', 'in', ['todo', 'in_progress', 'blocked']), limit(5)]
      );
    } catch (taskErr) {
      logger.info('No tasks found for dashboard summary', { file: 'api/dashboard/summary/route.ts', error: taskErr instanceof Error ? taskErr.message : String(taskErr) });
    }

    // Recent deals — best-effort (composite index may be missing).
    let recentDeals: DealRecord[] = [];
    try {
      recentDeals = await AdminFirestoreService.getAll<DealRecord>(
        recordsPath,
        [where('entityType', '==', 'deals'), orderBy('createdAt', 'desc'), limit(3)]
      );
    } catch (dealErr) {
      logger.info('Could not fetch recent deals for dashboard summary', { file: 'api/dashboard/summary/route.ts', error: dealErr instanceof Error ? dealErr.message : String(dealErr) });
    }

    // Recent leads — best-effort (composite index may be missing).
    let recentLeads: LeadRecord[] = [];
    try {
      recentLeads = await AdminFirestoreService.getAll<LeadRecord>(
        recordsPath,
        [where('entityType', '==', 'leads'), orderBy('createdAt', 'desc'), limit(3)]
      );
    } catch (leadErr) {
      logger.info('Could not fetch recent leads for dashboard summary', { file: 'api/dashboard/summary/route.ts', error: leadErr instanceof Error ? leadErr.message : String(leadErr) });
    }

    return NextResponse.json({
      success: true,
      leads,
      deals,
      conversations,
      tasks,
      recentDeals,
      recentLeads,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard summary';
    logger.error('Failed to fetch dashboard summary', error instanceof Error ? error : new Error(String(error)), { file: 'api/dashboard/summary/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
