/**
 * Playbook List API
 *
 * GET /api/playbook/list
 *
 * Returns all playbooks stored in the platform's Firestore sub-collection.
 * Uses the Admin SDK so it operates with full server-side credentials and
 * is not subject to client-side Firestore security rules.
 *
 * RESPONSE SHAPE (matches the PlaybooksApiResponse consumed by the playbook page):
 * {
 *   success: true,
 *   data: PlaybookDocument[]   // raw Firestore docs, page maps them to Playbook[]
 * }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/playbook/list
 *
 * Fetch every document from the platform's `playbooks` sub-collection and
 * return them as a JSON array under the `data` key.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDb) {
      logger.error('Playbook list: adminDb is not initialized');
      return NextResponse.json(
        { success: false, error: 'Database not initialized' },
        { status: 500 }
      );
    }

    const collectionPath = getSubCollection('playbooks');
    const snapshot = await adminDb.collection(collectionPath).get();

    // An empty collection is a valid state — return an empty array, not an error.
    if (snapshot.empty) {
      logger.info('Playbook list: collection is empty', { collectionPath });
      return NextResponse.json({ success: true, data: [] });
    }

    const playbooks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    logger.info('Playbook list: fetched playbooks', {
      count: playbooks.length,
      collectionPath,
    });

    return NextResponse.json({ success: true, data: playbooks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch playbooks';
    logger.error(
      'Playbook list: unexpected error',
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
