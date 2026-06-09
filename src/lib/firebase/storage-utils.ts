/**
 * Firebase Storage Utilities
 *
 * Persist externally-hosted assets (AI-generated images, etc.) to Firebase
 * Storage so URLs remain valid long after provider CDN links expire.
 */

import { randomUUID } from 'node:crypto';
import { adminStorage } from './admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

/**
 * Build a PERMANENT, publicly-fetchable Firebase Storage download URL using a
 * download token in the object's metadata. This is the standard way to get a
 * public URL that works WITH uniform bucket-level access (UBLA) enabled — unlike
 * `file.makePublic()` (per-object ACL), which throws on UBLA buckets. The token
 * acts as the access key; the URL never expires (unlike signed URLs).
 *
 * Usage: generate a token, write it as `firebaseStorageDownloadTokens` in the
 * object's CUSTOM metadata when saving, then return `firebaseDownloadUrl(...)`.
 */
export function firebaseDownloadUrl(bucketName: string, storagePath: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

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
  const token = randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        persistedAt: new Date().toISOString(),
        source: 'studio-generation',
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return firebaseDownloadUrl(bucket.name, storagePath, token);
}

/**
 * Persist an in-memory image buffer to Firebase Storage and return a signed URL.
 * Used when we modify an image (e.g. compositing the brand logo) before saving.
 */
export async function persistBufferToStorage(
  buffer: Buffer,
  storagePath: string,
  contentType = 'image/png',
): Promise<string | null> {
  if (!adminStorage) {
    return null;
  }
  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);
  const token = randomUUID();
  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        persistedAt: new Date().toISOString(),
        source: 'studio-generation-composited',
        firebaseStorageDownloadTokens: token,
      },
    },
  });
  return firebaseDownloadUrl(bucket.name, storagePath, token);
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
