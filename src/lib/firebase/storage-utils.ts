/**
 * Firebase Storage Utilities
 *
 * Persist externally-hosted assets (AI-generated images, etc.) to Firebase
 * Storage so URLs remain valid long after provider CDN links expire.
 */

import { adminStorage } from './admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

/**
 * Download a file from a URL and upload it to Firebase Storage.
 * Returns a long-lived signed URL (365 days).
 *
 * If Firebase Storage is unavailable, returns the original URL as a
 * graceful fallback (the caller can still use the temp URL short-term).
 */
export async function persistUrlToStorage(
  sourceUrl: string,
  storagePath: string,
  contentType = 'image/png',
): Promise<string> {
  if (!adminStorage) {
    logger.warn('[Storage] Firebase Storage not available, returning original URL', {
      file: 'storage-utils.ts',
    });
    return sourceUrl;
  }

  const response = await fetch(sourceUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download from provider: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        persistedAt: new Date().toISOString(),
        source: 'studio-generation',
      },
    },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
  });

  return signedUrl;
}

/**
 * Build a deterministic storage path for a studio generation image.
 */
export function studioImagePath(generationId: string): string {
  return `organizations/${PLATFORM_ID}/studio/images/${generationId}.png`;
}

/**
 * Check whether a URL points to Firebase Storage (permanent) vs a temporary
 * provider CDN. Safe for client-side use (no server imports).
 */
export function isPersistedUrl(url: string): boolean {
  return url.includes('storage.googleapis.com') || url.includes('firebasestorage.googleapis.com');
}
