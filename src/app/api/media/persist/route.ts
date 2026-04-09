/**
 * POST /api/media/persist
 *
 * Takes a temporary provider URL, downloads the image, uploads to Firebase
 * Storage, and returns the permanent URL. Also updates any matching media
 * library entries so their URLs stay alive too.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { persistUrlToStorage, studioImagePath, isPersistedUrl } from '@/lib/firebase/storage-utils';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const MEDIA_COLLECTION = getSubCollection('media');

const PersistSchema = z.object({
  url: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const { url } = PersistSchema.parse(body);

    // Already persisted — nothing to do
    if (isPersistedUrl(url)) {
      return NextResponse.json({ success: true, url });
    }

    // Download from provider CDN and upload to Firebase Storage
    const storagePath = studioImagePath(crypto.randomUUID());
    const permanentUrl = await persistUrlToStorage(url, storagePath, 'image/png');

    logger.info('Media persist: image saved to Firebase Storage', {
      originalUrl: url.slice(0, 80),
      file: 'api/media/persist/route.ts',
    });

    // Update any media library entries that still reference the old URL
    if (adminDb) {
      try {
        const snap = await adminDb
          .collection(MEDIA_COLLECTION)
          .where('url', '==', url)
          .limit(5)
          .get();

        const batch = adminDb.batch();
        for (const doc of snap.docs) {
          batch.update(doc.ref, { url: permanentUrl, updatedAt: new Date() });
        }
        if (!snap.empty) {
          await batch.commit();
          logger.info(`Media persist: updated ${snap.size} media library entries`, {
            file: 'api/media/persist/route.ts',
          });
        }
      } catch (updateErr) {
        logger.warn('Media persist: failed to update library entries (non-fatal)', {
          error: updateErr instanceof Error ? updateErr.message : String(updateErr),
          file: 'api/media/persist/route.ts',
        });
      }
    }

    return NextResponse.json({ success: true, url: permanentUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Persist failed';
    const isDownloadFailure = msg.includes('Failed to download');
    if (isDownloadFailure) {
      // Expected when provider CDN URL has expired — not a server error
      logger.info('Media persist: provider URL expired, regeneration required', {
        file: 'api/media/persist/route.ts',
      });
      return NextResponse.json({ success: false, error: 'expired' }, { status: 410 });
    }
    logger.error('Media persist failed', error instanceof Error ? error : new Error(msg), {
      file: 'api/media/persist/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
